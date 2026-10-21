/** Cek kedaluwarsa promo tanpa memanggil fungsi impure di dalam render server. */
export function isPromoExpired(promo: { endsAt: Date | null }, now: number = Date.now()): boolean {
  return Boolean(promo.endsAt && new Date(promo.endsAt).getTime() < now);
}
