/** Batas waktu invoice agar bisa dibayar. */
export const INVOICE_EXPIRY_MINUTES = 30;

export function invoiceExpiryDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVOICE_EXPIRY_MINUTES * 60_000);
}
