import type { BillingCycle, Plan, PromoCode, PriceSnapshot } from "@/lib/db/schema";
import type { Plan as PlanType } from "@/lib/db/schema";

export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export function roundToNineThousand(value: number): number {
  // Gaya harga retail: ribuan terdekat yang berakhiran 9.000.
  if (value <= 9000) return 9000;
  return Math.round((value - 9000) / 10000) * 10000 + 9000;
}

/** Harga satuan paket untuk satu siklus (sudah termasuk promo bulanan bila ada). */
export function cycleUnitPrice(plan: PlanType, cycle: BillingCycle): number {
  if (cycle === "monthly") {
    return plan.promoPriceMonthly && plan.promoPriceMonthly > 0 && plan.promoPriceMonthly < plan.priceMonthly
      ? plan.promoPriceMonthly
      : plan.priceMonthly;
  }
  if (cycle === "quarterly") {
    return plan.priceQuarterly ?? plan.priceMonthly * 3;
  }
  return plan.priceYearly ?? plan.priceMonthly * 12;
}

export function normalCyclePrice(plan: PlanType, cycle: BillingCycle): number {
  if (cycle === "monthly") return plan.priceMonthly;
  if (cycle === "quarterly") return plan.priceQuarterly ?? plan.priceMonthly * 3;
  return plan.priceYearly ?? plan.priceMonthly * 12;
}

export function cycleDiscountPercent(plan: PlanType, cycle: BillingCycle): number {
  const normal = plan.priceMonthly * CYCLE_MONTHS[cycle];
  const actual = normalCyclePrice(plan, cycle);
  if (!normal || actual >= normal) return 0;
  return Math.round(((normal - actual) / normal) * 100);
}

export function promoDiscountPercent(plan: PlanType): number {
  if (!plan.promoPriceMonthly || plan.promoPriceMonthly >= plan.priceMonthly) return 0;
  return Math.round(((plan.priceMonthly - plan.promoPriceMonthly) / plan.priceMonthly) * 100);
}

export function calculateDiscount(promo: PromoCode | null | undefined, subtotal: number): number {
  if (!promo) return 0;
  if (promo.type === "percent") {
    const raw = Math.round((subtotal * promo.value) / 100);
    return promo.maxDiscount ? Math.min(raw, promo.maxDiscount) : raw;
  }
  return Math.min(promo.value, subtotal);
}

export type PriceBreakdown = {
  unitPrice: number;
  subtotal: number;
  setupFee: number;
  discount: number;
  total: number;
  months: number;
  normalSubtotal: number;
};

export function priceBreakdown(
  plan: PlanType,
  cycle: BillingCycle,
  opts?: { promo?: PromoCode | null; includeSetup?: boolean },
): PriceBreakdown {
  const months = CYCLE_MONTHS[cycle];
  const unitPrice = cycleUnitPrice(plan, cycle);
  const subtotal = unitPrice;
  const setupFee = opts?.includeSetup === false ? 0 : plan.setupFee;
  const discount = calculateDiscount(opts?.promo, subtotal);
  return {
    unitPrice,
    subtotal,
    setupFee,
    discount,
    total: Math.max(0, subtotal + setupFee - discount),
    months,
    normalSubtotal: normalCyclePrice(plan, cycle),
  };
}

export function buildPriceSnapshot(
  plan: PlanType,
  cycle: BillingCycle,
  promo?: PromoCode | null,
): PriceSnapshot {
  const p = priceBreakdown(plan, cycle, { promo, includeSetup: true });
  return {
    planName: plan.name,
    planSlug: plan.slug,
    cycle,
    months: p.months,
    unitPrice: p.unitPrice,
    subtotal: p.subtotal,
    setupFee: p.setupFee,
    discount: p.discount,
    total: p.total,
    promoCode: promo?.code ?? null,
    promoDescription: promo
      ? promo.type === "percent"
        ? `${promo.value}%`
        : `Potongan Rp ${promo.value.toLocaleString("id-ID")}`
      : null,
    currency: "IDR",
  };
}

export function renewalPrice(plan: PlanType, cycle: BillingCycle): number {
  return cycleUnitPrice(plan, cycle);
}

export function upgradeProration(input: {
  currentPrice: number;
  targetPrice: number;
  periodStart: Date | null;
  periodEnd: Date | null;
}): number {
  const { currentPrice, targetPrice, periodStart, periodEnd } = input;
  if (!periodStart || !periodEnd) return Math.max(0, targetPrice - currentPrice);
  const total = Math.max(1, periodEnd.getTime() - periodStart.getTime());
  const remaining = Math.max(0, periodEnd.getTime() - Date.now());
  const ratio = Math.min(1, remaining / total);
  return Math.max(0, Math.round((targetPrice - currentPrice) * ratio));
}

export function marginInfo(input: {
  priceMonthly: number;
  costMonthlyUsd: number;
  usdIdrRate: number;
}) {
  const modal = Math.round(input.costMonthlyUsd * input.usdIdrRate);
  const margin = input.priceMonthly - modal;
  const percent = input.priceMonthly > 0 ? (margin / input.priceMonthly) * 100 : 0;
  return { modal, margin, percent, belowCost: margin < 0, low: percent < 10 };
}

export function priceFromMarkup(costUsd: number, rate: number, markupPercent: number): number {
  const raw = costUsd * rate * (1 + markupPercent / 100);
  return Math.round(raw / 1000) * 1000;
}

export type { Plan };
