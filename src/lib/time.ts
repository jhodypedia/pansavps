/**
 * Semua tanggal bisnis PansaVPS memakai WIB (Asia/Jakarta, UTC+7).
 * Server produksi berjalan di UTC, jadi jangan bergantung pada timezone OS.
 */
export const APP_TIME_ZONE = "Asia/Jakarta";
export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

type DateParts = { year: number; month: number; day: number };

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getWibDateParts(value: Date | number | string = new Date()): DateParts {
  const parts = partsFormatter.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Tanggal kalender WIB dalam format YYYY-MM-DD. */
export function wibDateKey(value: Date | number | string = new Date()): string {
  const { year, month, day } = getWibDateParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Tanggal kalender WIB dalam format YYYYMMDD untuk nomor dokumen. */
export function wibDateCompact(value: Date | number | string = new Date()): string {
  const { year, month, day } = getWibDateParts(value);
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

export function wibYearMonth(value: Date | number | string = new Date()): string {
  const { year, month } = getWibDateParts(value);
  return `${year}${String(month).padStart(2, "0")}`;
}

/**
 * Selisih hari kalender WIB. Contoh: periodEnd besok 10.00 WIB dan sekarang
 * 22.00 WIB menghasilkan 1, bukan 0 seperti perhitungan jam/timestamp.
 */
export function differenceInWibCalendarDays(
  target: Date | number | string,
  from: Date | number | string = new Date(),
): number {
  const targetParts = getWibDateParts(target);
  const fromParts = getWibDateParts(from);
  const targetUtc = Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day);
  const fromUtc = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  return Math.round((targetUtc - fromUtc) / 86_400_000);
}

export function startOfWibDay(value: Date | number | string = new Date()): Date {
  const { year, month, day } = getWibDateParts(value);
  return new Date(Date.UTC(year, month - 1, day) - WIB_OFFSET_MS);
}
