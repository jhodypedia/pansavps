export type PaymentMethod = "manual" | "tripay";

export type TripayChannel = {
  code: string;
  name: string;
  group: string;
  iconUrl: string;
};

export type PaymentGatewayInfo = {
  /** Nominal dasar yang diterima merchant. */
  subtotal: number;
  /** Biaya channel yang dibebankan ke pelanggan. */
  feeCustomer: number;
  /** Biaya channel yang ditanggung merchant. */
  feeMerchant: number;
  /** Total yang dibayar pelanggan. */
  total: number;
};

export type PaymentIntent = {
  provider: PaymentMethod;
  redirectUrl?: string;
  token?: string;
  reference?: string;
  instructions?: string;
  qrString?: string;
  channel?: string;
  gateway?: PaymentGatewayInfo;
};

export type GatewayStatus = "paid" | "pending" | "failed";

export function parseAmount(value: string | number): number {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
