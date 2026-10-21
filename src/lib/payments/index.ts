import "server-only";

import type { Invoice } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { tripayEnabled, createTripayPayment } from "./tripay";
import type { PaymentIntent, PaymentMethod } from "./types";

export type ProviderInfo = {
  id: PaymentMethod;
  label: string;
  description: string;
  enabled: boolean;
};

export function availableProviders(): ProviderInfo[] {
  const s = getSettings();
  const order = (s.payment_providers_order || "manual,tripay")
    .split(",")
    .map((x) => x.trim());
  const all: ProviderInfo[] = [
    {
      id: "manual",
      label: "Transfer Manual",
      description: `Transfer ke ${s.manual_bank_name} ${s.manual_account_number}. Verifikasi oleh admin.`,
      enabled: s.manual_enabled === "true",
    },
    {
      id: "tripay",
      label: "Pembayaran Online",
      description: "QRIS, virtual account, dan gerai retail.",
      enabled: tripayEnabled(),
    },
  ];
  return all
    .filter((p) => p.enabled)
    .sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
}

export function isProviderEnabled(method: PaymentMethod): boolean {
  if (method === "manual") return getSettings().manual_enabled === "true";
  return tripayEnabled();
}

export async function createGatewayPayment(
  invoice: Invoice,
  method: Exclude<PaymentMethod, "manual">,
  customer: { name: string; email: string; phone?: string | null },
  channel?: string,
): Promise<PaymentIntent> {
  if (method === "tripay") return createTripayPayment(invoice, customer, channel);
  throw new Error("Metode pembayaran gateway tidak dikenal.");
}

export { tripayEnabled };
export type { PaymentIntent, PaymentMethod };
