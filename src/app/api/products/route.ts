import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { suggestedWeeklyPrice } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Katalog produk publik. Produk disinkronkan dari DigitalOcean
 * (GET /v2/sizes) melalui panel admin, lalu harga jual dihitung dari
 * kurs + markup atau harga custom per produk.
 */
export async function GET() {
  const rows = db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.sortOrder), asc(plans.id))
    .all();

  return NextResponse.json(
    {
      ok: true,
      source: "digitalocean",
      data: rows.map((plan) => ({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        doSizeSlug: plan.doSizeSlug,
        specs: {
          vcpus: plan.vcpus,
          ramMb: plan.ramMb,
          diskGb: plan.diskGb,
          transferTb: plan.transferTb,
        },
        pricing: {
          currency: "IDR",
          mode: plan.pricingMode,
          weekly:
            plan.priceWeekly && plan.priceWeekly > 0
              ? plan.priceWeekly
              : suggestedWeeklyPrice(plan.priceMonthly),
          monthly: plan.priceMonthly,
          quarterly: plan.priceQuarterly ?? plan.priceMonthly * 3,
          yearly: plan.priceYearly ?? plan.priceMonthly * 12,
          promoMonthly:
            plan.promoPriceMonthly && plan.promoPriceMonthly > 0 && plan.promoPriceMonthly < plan.priceMonthly
              ? plan.promoPriceMonthly
              : null,
        },
        regions: plan.allowRegionSlugs,
        featured: plan.isFeatured,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
