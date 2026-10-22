import { formatDistanceToNowStrict } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { APP_TIME_ZONE, wibDateCompact, wibYearMonth } from "@/lib/time";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatIDR(value: number | null | undefined): string {
  return idr.format(Number(value ?? 0)).replace(/\u00a0/g, " ");
}

export function formatIDRShort(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1).replace(".0", "")} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1).replace(".0", "")} jt`;
  if (value >= 1_000) return `Rp ${Math.round(value / 1_000)} rb`;
  return formatIDR(value);
}

const longDateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const shortDateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDate(value: Date | number | string | null | undefined): string {
  if (!value) return "—";
  return longDateFormatter.format(new Date(value));
}

export function formatDateTime(value: Date | number | string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  const parts = dateTimeFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} WIB`;
}

export function formatDateShort(value: Date | number | string | null | undefined): string {
  if (!value) return "—";
  return shortDateFormatter.format(new Date(value));
}

export function formatRelative(value: Date | number | string | null | undefined): string {
  if (!value) return "—";
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true, locale: localeId });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

export const cycleLabel: Record<string, string> = {
  weekly: "Mingguan",
  monthly: "Bulanan",
  quarterly: "3 Bulan",
  yearly: "Tahunan",
};

export const cyclePriceUnit: Record<string, string> = {
  weekly: "minggu",
  monthly: "bulan",
  quarterly: "3 bulan",
  yearly: "tahun",
};

export const cycleMonths: Record<string, number> = {
  weekly: 7 / 30,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export const orderStatusLabel: Record<string, string> = {
  pending_payment: "Menunggu Pembayaran",
  paid: "Sudah Dibayar",
  provisioning: "Membuat Server",
  active: "Aktif",
  failed: "Gagal",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

export const invoiceStatusLabel: Record<string, string> = {
  unpaid: "Menunggu Pembayaran",
  paid: "Lunas",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
  refunded: "Dikembalikan",
};

export const paymentStatusLabel: Record<string, string> = {
  pending: "Menunggu",
  paid: "Lunas",
  failed: "Tidak berhasil",
  rejected: "Ditolak",
};

export const serviceStatusLabel: Record<string, string> = {
  provisioning: "Menyiapkan",
  active: "Aktif",
  suspended: "Ditangguhkan",
  terminated: "Dihentikan",
  failed: "Gagal",
};

export const invoiceTypeLabel: Record<string, string> = {
  new: "Pesanan Baru",
  renewal: "Perpanjangan",
  upgrade: "Upgrade",
  topup: "Top Up Saldo",
};

export const ticketStatusLabel: Record<string, string> = {
  open: "Terbuka",
  answered: "Dibalas",
  closed: "Ditutup",
};

export const ticketPriorityLabel: Record<string, string> = {
  low: "Rendah",
  normal: "Normal",
  high: "Tinggi",
  urgent: "Mendesak",
};

export function statusTone(
  status: string,
): "success" | "warning" | "danger" | "neutral" | "info" {
  if (["active", "paid", "sent", "connected", "success", "closed"].includes(status))
    return "success";
  if (
    ["pending_payment", "unpaid", "provisioning", "queued", "open", "answered", "connecting", "qr_pending", "pairing_pending"].includes(
      status,
    )
  )
    return "warning";
  if (["failed", "cancelled", "expired", "suspended", "terminated", "rejected"].includes(status))
    return "danger";
  if (["refunded", "disconnected"].includes(status)) return "neutral";
  return "info";
}

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  if (digits.startsWith("620")) digits = `62${digits.slice(3)}`;
  return digits;
}

export function waJid(raw: string): string {
  return `${normalizePhone(raw)}@s.whatsapp.net`;
}

export function isValidPhone(raw: string | null | undefined): boolean {
  const n = normalizePhone(raw);
  return /^628\d{7,12}$/.test(n);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function hostnameValid(value: string): boolean {
  return /^(?=.{1,63}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(
    value,
  );
}

export function humanBytes(bytes: number, decimals = 1): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function uid(prefix: string, length = 14): string {
  const alphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${prefix}${out}`;
}

export function orderNumber(): string {
  return `ORD-${wibDateCompact()}-${uid("", 4)}`;
}

export function invoiceNumber(): string {
  return `INV-${wibYearMonth()}-${uid("", 6)}`;
}

export function ticketNumber(): string {
  return `TKT-${uid("", 8)}`;
}
