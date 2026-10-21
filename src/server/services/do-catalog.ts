import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, regions } from "@/lib/db/schema";
import type { Plan } from "@/lib/db/schema";
import { listSizes, type DoSize } from "@/lib/digitalocean";
import { getDefaultDoAccount } from "@/lib/do-accounts";
import { getSettings, isMockMode } from "@/lib/settings";
import { priceFromMarkup, suggestedWeeklyPrice } from "@/lib/pricing";

export type DoCatalogItem = {
  size: DoSize;
  plan: Plan | null;
  suggestedPrice: number;
};

export async function loadDoCatalog(): Promise<{
  items: DoCatalogItem[];
  error: string | null;
  mock: boolean;
}> {
  const settings = getSettings();
  const rate = Number(settings.usd_idr_rate || 16500);
  const markup = Number(settings.default_markup_percent || 30);
  const planRows = db.select().from(plans).all();
  const planBySize = new Map(
    planRows.filter((plan) => plan.doSizeSlug).map((plan) => [plan.doSizeSlug, plan]),
  );

  try {
    const sizes = await listSizes(getDefaultDoAccount()?.id);
    const items = sizes
      .slice()
      .sort((a, b) => a.memory - b.memory || a.vcpus - b.vcpus || a.disk - b.disk)
      .map((size) => ({
        size,
        plan: planBySize.get(size.slug) ?? null,
        suggestedPrice: priceFromMarkup(size.price_monthly, rate, markup),
      }));
    return { items, error: null, mock: isMockMode() };
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : "Gagal mengambil katalog DigitalOcean.",
      mock: isMockMode(),
    };
  }
}

export function autoCyclePrices(monthly: number): { quarterly: number; yearly: number } {
  const round = (value: number) => Math.round(value / 1000) * 1000;
  return {
    quarterly: round(monthly * 3 * 0.95),
    yearly: round(monthly * 12 * 0.83),
  };
}

export function recalculateAutoPlanPrices(): { updated: number } {
  const settings = getSettings();
  const rate = Number(settings.usd_idr_rate || 16500);
  const markup = Number(settings.default_markup_percent || 30);
  const autoPlans = db.select().from(plans).where(eq(plans.pricingMode, "auto")).all();
  let updated = 0;

  db.transaction((tx) => {
    for (const plan of autoPlans) {
      const nextPrice = priceFromMarkup(plan.costMonthlyUsd, rate, markup);
      const nextPromo =
        plan.promoPriceMonthly && plan.promoPriceMonthly > 0 && plan.promoPriceMonthly >= nextPrice
          ? null
          : plan.promoPriceMonthly;
      // Harga siklus mengikuti harga bulanan otomatis dengan diskon tetap.
      const cycles = autoCyclePrices(nextPrice);
      const nextQuarterly = cycles.quarterly;
      const nextYearly = cycles.yearly;
      if (
        nextPrice === plan.priceMonthly &&
        nextPromo === plan.promoPriceMonthly &&
        nextQuarterly === plan.priceQuarterly &&
        nextYearly === plan.priceYearly
      ) {
        continue;
      }
      tx.update(plans)
        .set({
          priceMonthly: nextPrice,
          priceQuarterly: nextQuarterly,
          priceYearly: nextYearly,
          promoPriceMonthly: nextPromo,
          updatedAt: new Date(),
        })
        .where(eq(plans.id, plan.id))
        .run();
      updated++;
    }
  });

  return { updated };
}

function planName(size: DoSize): string {
  const ram = size.memory >= 1024 ? `${size.memory / 1024} GB` : `${size.memory} MB`;
  return `VPS ${ram} · ${size.vcpus} vCPU`;
}

function chooseRegions(size: DoSize, activeRegionSlugs: Set<string>): string[] {
  const available = size.regions?.filter((slug) => activeRegionSlugs.has(slug)) ?? [];
  if (available.length > 0) return available;
  if (activeRegionSlugs.has("sgp1")) return ["sgp1"];
  const fallback = [...activeRegionSlugs].slice(0, 1);
  return fallback.length ? fallback : ["sgp1"];
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}-${index}`)) index++;
  return `${base}-${index}`;
}

export async function syncDoCatalog(): Promise<{
  created: number;
  updated: number;
  autoPrices: number;
  total: number;
}> {
  const settings = getSettings();
  const rate = Number(settings.usd_idr_rate || 16500);
  const markup = Number(settings.default_markup_percent || 30);
  const sizes = await listSizes(getDefaultDoAccount()?.id);
  const regionRows = db.select().from(regions).all();
  const activeRegions = new Set(regionRows.filter((region) => region.isActive).map((region) => region.slug));
  const existing = db.select().from(plans).all();
  const bySize = new Map(existing.filter((plan) => plan.doSizeSlug).map((plan) => [plan.doSizeSlug, plan]));
  const takenSlugs = new Set(existing.map((plan) => plan.slug));
  let nextSort = existing.reduce((max, plan) => Math.max(max, plan.sortOrder), 0);
  let created = 0;
  let updated = 0;

  db.transaction((tx) => {
    for (const size of sizes) {
      if (!size.available) continue;
      const supported = size.regions?.some((slug) => activeRegions.has(slug)) ?? true;
      if (!supported) continue;
      const current = bySize.get(size.slug);
      const cost = Number(size.price_monthly) || 0;

      if (current) {
        const allowed = chooseRegions(size, activeRegions);
        tx.update(plans)
          .set({
            vcpus: size.vcpus,
            ramMb: size.memory,
            diskGb: size.disk,
            transferTb: Math.max(0, Math.round(Number(size.transfer) || 0)),
            costMonthlyUsd: cost,
            allowRegionSlugs: allowed.length ? allowed : current.allowRegionSlugs,
            updatedAt: new Date(),
          })
          .where(eq(plans.id, current.id))
          .run();
        updated++;
        continue;
      }

      const slug = uniqueSlug(size.slug, takenSlugs);
      takenSlugs.add(slug);
      const priceMonthly = priceFromMarkup(cost, rate, markup);
      const cycles = autoCyclePrices(priceMonthly);
      tx.insert(plans)
        .values({
          name: planName(size),
          slug,
          description: `DigitalOcean ${size.slug} dengan ${size.vcpus} vCPU, ${size.memory / 1024} GB RAM, dan ${size.disk} GB SSD.`,
          doSizeSlug: size.slug,
          vcpus: size.vcpus,
          ramMb: size.memory,
          diskGb: size.disk,
          transferTb: Math.max(0, Math.round(Number(size.transfer) || 0)),
          costMonthlyUsd: cost,
          priceMonthly,
          priceWeekly: suggestedWeeklyPrice(priceMonthly),
          priceQuarterly: cycles.quarterly,
          priceYearly: cycles.yearly,
          pricingMode: "auto",
          isActive: true,
          isFeatured: false,
          allowRegionSlugs: chooseRegions(size, activeRegions),
          sortOrder: ++nextSort,
        })
        .run();
      created++;
    }
  });

  const { updated: autoPrices } = recalculateAutoPlanPrices();
  const total = db.select().from(plans).all().length;
  return { created, updated, autoPrices, total };
}
