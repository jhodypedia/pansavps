import "server-only";

import crypto from "node:crypto";
import { getSettings } from "@/lib/settings";
import type { Invoice } from "@/lib/db/schema";
import { parseAmount, type GatewayStatus, type PaymentIntent, type TripayChannel } from "./types";
import { INVOICE_EXPIRY_MINUTES } from "@/lib/invoices";

export function tripayEnabled(): boolean {
  const s = getSettings();
  return (
    s.tripay_enabled === "true" &&
    Boolean(s.tripay_api_key) &&
    Boolean(s.tripay_private_key) &&
    Boolean(s.tripay_merchant_code)
  );
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export type TripayAmountInfo = {
  /** Nominal total yang dibayar pelanggan (termasuk fee customer). */
  amount: number;
  /** Alias total tagihan dari Tripay. */
  totalAmount: number;
  /** Nominal dasar yang diterima merchant. */
  amountReceived: number;
  feeCustomer: number;
  feeMerchant: number;
};

export type TripayTransaction = TripayAmountInfo & {
  reference: string;
  merchantRef: string;
  status: GatewayStatus;
  rawStatus: string;
  paymentMethod: string;
  paymentName: string;
  paidAt: number | null;
  raw: Record<string, unknown>;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function amountValue(value: unknown): number {
  if (typeof value === "number" || typeof value === "string") return parseAmount(value);
  return 0;
}

function paidAtValue(value: unknown): number | null {
  const raw = amountValue(value);
  if (!raw) return null;
  // Tripay mengirim Unix timestamp dalam detik.
  return raw > 10_000_000_000 ? raw : raw * 1000;
}

/**
 * Normalisasi nominal Tripay. Pada transaksi closed payment, `amount` adalah
 * total yang dibayar pelanggan, sedangkan `amount_received` adalah subtotal
 * yang diterima merchant sebelum biaya channel.
 */
export function tripayAmountInfo(payload: Record<string, unknown>): TripayAmountInfo {
  const amount = amountValue(payload.amount) || amountValue(payload.total_amount);
  const feeCustomer = amountValue(payload.fee_customer);
  const feeMerchant = amountValue(payload.fee_merchant);
  const totalAmount = amountValue(payload.total_amount) || amount;
  const received = amountValue(payload.amount_received);
  const amountReceived = received || Math.max(0, amount - feeCustomer);
  return { amount, totalAmount, amountReceived, feeCustomer, feeMerchant };
}

export function tripayAmountMatchesInvoice(invoiceAmount: number, info: TripayAmountInfo): boolean {
  // Terima beberapa variasi payload Tripay: total yang dibayar pelanggan,
  // subtotal yang diterima merchant, atau total setelah dikurangi fee customer.
  const candidates = new Set(
    [
      info.amountReceived,
      info.amount,
      info.totalAmount,
      info.amount - info.feeCustomer,
      info.totalAmount - info.feeCustomer,
    ].filter((value) => Number.isFinite(value) && value > 0),
  );
  return candidates.has(invoiceAmount);
}

export function normalizeTripayTransaction(
  data: Record<string, unknown>,
  raw?: Record<string, unknown>,
): TripayTransaction {
  const info = tripayAmountInfo(data);
  const status = stringValue(data.status);
  return {
    ...info,
    reference: stringValue(data.reference),
    merchantRef: stringValue(data.merchant_ref),
    status: mapTripayStatus(status),
    rawStatus: status,
    paymentMethod: stringValue(data.payment_method),
    paymentName: stringValue(data.payment_name),
    paidAt: paidAtValue(data.paid_at),
    raw: raw ?? data,
  };
}

export async function fetchTripayTransaction(reference: string): Promise<TripayTransaction | null> {
  const s = getSettings();
  if (!tripayEnabled() || !reference) return null;
  const base =
    s.tripay_is_sandbox === "true"
      ? "https://tripay.co.id/api-sandbox"
      : "https://tripay.co.id/api";
  const res = await fetch(`${base}/transaction/detail?reference=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${s.tripay_api_key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
  if (!res.ok) {
    throw new Error(body.message?.trim() || `Tripay HTTP ${res.status}`);
  }
  if (!body.success || !body.data) return null;
  return normalizeTripayTransaction(body.data, body as unknown as Record<string, unknown>);
}

type ChannelCache = {
  key: string;
  expiresAt: number;
  channels: TripayChannel[];
};

let channelCache: ChannelCache | null = null;

function channelCacheKey(apiKey: string, sandbox: string): string {
  return crypto
    .createHash("sha256")
    .update(`${sandbox}|${apiKey}`)
    .digest("hex");
}

function fallbackChannel(): TripayChannel {
  return { code: "QRIS", name: "QRIS", group: "Lainnya", iconUrl: "" };
}

function normalizeChannel(raw: unknown): TripayChannel | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as {
    code?: unknown;
    name?: unknown;
    group?: unknown;
    icon_url?: unknown;
    active?: unknown;
  };
  if (item.active === false) return null;
  const code = typeof item.code === "string" ? item.code.trim().toUpperCase() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!code || !name) return null;
  const iconUrl =
    typeof item.icon_url === "string" && /^https?:\/\//i.test(item.icon_url)
      ? item.icon_url
      : "";
  return {
    code,
    name,
    group: typeof item.group === "string" && item.group.trim() ? item.group.trim() : "Lainnya",
    iconUrl,
  };
}

/**
 * Ambil channel aktif langsung dari Tripay. Hasil disimpan di cache memori
 * sebentar agar halaman pembayaran tidak memanggil API berulang kali.
 * Jika gateway belum aktif / API gagal, gunakan channel default dari admin.
 */
export async function listTripayChannels(): Promise<TripayChannel[]> {
  const s = getSettings();
  if (s.tripay_enabled !== "true" || !s.tripay_api_key) return [];

  const key = channelCacheKey(s.tripay_api_key, s.tripay_is_sandbox);
  if (channelCache && channelCache.key === key && channelCache.expiresAt > Date.now()) {
    return channelCache.channels;
  }

  const base =
    s.tripay_is_sandbox === "true"
      ? "https://tripay.co.id/api-sandbox"
      : "https://tripay.co.id/api";
  try {
    const res = await fetch(`${base}/merchant/payment-channel`, {
      headers: { Authorization: `Bearer ${s.tripay_api_key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
      data?: unknown;
    };
    const channels = Array.isArray(body.data)
      ? body.data
          .map(normalizeChannel)
          .filter((item): item is TripayChannel => Boolean(item))
          .filter((item, index, all) => all.findIndex((x) => x.code === item.code) === index)
          .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
      : [];

    if (!res.ok || !body.success || channels.length === 0) {
      if (!res.ok || !body.success) {
        console.warn(`[tripay] gagal memuat channel: ${body.message ?? res.status}`);
      }
      const fallback = [fallbackChannel()];
      channelCache = { key, expiresAt: Date.now() + 60_000, channels: fallback };
      return fallback;
    }

    channelCache = { key, expiresAt: Date.now() + 5 * 60_000, channels };
    return channels;
  } catch (error) {
    console.warn("[tripay] gagal memuat channel", error);
    const fallback = [fallbackChannel()];
    channelCache = { key, expiresAt: Date.now() + 60_000, channels: fallback };
    return fallback;
  }
}

export async function createTripayPayment(
  invoice: Invoice,
  customer: { name: string; email: string; phone?: string | null },
  channel?: string,
): Promise<PaymentIntent> {
  const s = getSettings();
  if (!tripayEnabled()) throw new Error("Tripay belum diaktifkan admin.");
  const isSandbox = s.tripay_is_sandbox === "true";
  const base = isSandbox
    ? "https://tripay.co.id/api-sandbox/transaction/create"
    : "https://tripay.co.id/api/transaction/create";
  const merchantRef = invoice.invoiceNumber;
  const method = (channel?.trim() || "QRIS").toUpperCase();
  const signature = crypto
    .createHmac("sha256", s.tripay_private_key)
    .update(`${s.tripay_merchant_code}${merchantRef}${invoice.amount}`)
    .digest("hex");

  const res = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.tripay_api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method,
      merchant_ref: merchantRef,
      amount: invoice.amount,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone ?? "08123456789",
      order_items: [
        {
          sku: invoice.type,
          name: `Invoice ${invoice.invoiceNumber}`,
          price: invoice.amount,
          quantity: 1,
        },
      ],
      callback_url: `${appUrl()}/api/payments/tripay/webhook`,
      return_url: `${appUrl()}/dashboard/invoices/${invoice.id}?bayar=tripay`,
      expired_time: Math.floor(Date.now() / 1000) + INVOICE_EXPIRY_MINUTES * 60,
      signature,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
  if (!res.ok || !data.success || !data.data) {
    const detail = data.message?.trim();
    throw new Error(
      detail
        ? `Gagal membuat transaksi Tripay: ${detail}`
        : "Gagal membuat transaksi Tripay. Periksa konfigurasi gateway.",
    );
  }
  const tx = normalizeTripayTransaction(
    { ...data.data, merchant_ref: data.data.merchant_ref ?? merchantRef, payment_method: method },
    data as unknown as Record<string, unknown>,
  );
  return {
    provider: "tripay",
    redirectUrl: stringValue(data.data.checkout_url) || undefined,
    reference: stringValue(data.data.reference) || undefined,
    qrString: stringValue(data.data.qr_string) || undefined,
    channel: method,
    gateway: {
      subtotal: tx.amountReceived || invoice.amount,
      feeCustomer: tx.feeCustomer,
      feeMerchant: tx.feeMerchant,
      total: tx.totalAmount || tx.amount || invoice.amount,
    },
  };
}

export function verifyTripaySignature(rawBody: string, signature: string): boolean {
  const privateKey = getSettings().tripay_private_key;
  if (!privateKey || !signature) return false;
  const expected = crypto.createHmac("sha256", privateKey).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function mapTripayStatus(status: string | undefined): GatewayStatus {
  const s = (status ?? "").toUpperCase();
  if (s === "PAID") return "paid";
  if (s === "UNPAID" || s === "PENDING") return "pending";
  return "failed";
}

export function tripayAmount(payload: {
  amount?: number | string;
  total_amount?: number | string;
  amount_received?: number | string;
  fee_customer?: number | string;
}): number {
  return tripayAmountInfo(payload as Record<string, unknown>).amountReceived;
}
