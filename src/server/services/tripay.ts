import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, payments, type Invoice } from "@/lib/db/schema";
import {
  fetchTripayTransaction,
  tripayAmountMatchesInvoice,
  type TripayTransaction,
} from "@/lib/payments/tripay";
import { settleInvoice } from "./billing";

export type ReconcileTripayResult = {
  status: string;
  settled: boolean;
  message: string;
};

export type ReconcileTripayInput = {
  invoice: Invoice;
  reference?: string | null;
  transaction?: TripayTransaction;
  /** Payload mentah dari webhook, atau metadata tambahan saat sync. */
  raw?: Record<string, unknown>;
};

function gatewayMetadata(tx: TripayTransaction, fallbackReference: string) {
  return {
    provider: "tripay",
    reference: tx.reference || fallbackReference,
    merchantRef: tx.merchantRef,
    subtotal: tx.amountReceived,
    amountReceived: tx.amountReceived,
    feeCustomer: tx.feeCustomer,
    feeMerchant: tx.feeMerchant,
    total: tx.totalAmount || tx.amount,
    amount: tx.amount,
    method: tx.paymentMethod,
    paymentName: tx.paymentName,
    status: tx.rawStatus,
    paidAt: tx.paidAt,
    syncedAt: Date.now(),
  };
}

function saveGatewayMetadata(invoice: Invoice, tx: TripayTransaction, reference: string) {
  const current = db.select().from(invoices).where(eq(invoices.id, invoice.id)).get();
  const metadata = (current?.metadata ?? invoice.metadata ?? {}) as Record<string, unknown>;
  db.update(invoices)
    .set({ metadata: { ...metadata, tripay: gatewayMetadata(tx, reference) } })
    .where(eq(invoices.id, invoice.id))
    .run();
}

/**
 * Satu jalur rekonsiliasi untuk webhook, polling halaman invoice, dan cron.
 * Nominal divalidasi terhadap subtotal invoice, bukan total yang sudah
 * ditambah fee customer gateway.
 */
export async function reconcileTripayPayment(
  input: ReconcileTripayInput,
): Promise<ReconcileTripayResult> {
  const { invoice } = input;
  if (invoice.status === "paid") {
    return { status: "paid", settled: false, message: "Invoice sudah lunas." };
  }
  if (!["unpaid", "expired"].includes(invoice.status)) {
    return {
      status: invoice.status,
      settled: false,
      message: "Invoice ini tidak dapat diproses lagi.",
    };
  }

  const existing = db
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoice.id), eq(payments.provider, "tripay")))
    .orderBy(desc(payments.createdAt))
    .get();
  const reference =
    input.reference?.trim() || invoice.paymentRef?.trim() || existing?.providerRef?.trim() || "";

  if (!reference && !input.transaction) {
    return {
      status: invoice.status,
      settled: false,
      message: "Referensi transaksi Tripay belum tersedia.",
    };
  }

  let tx = input.transaction;
  if (!tx) {
    try {
      tx = (await fetchTripayTransaction(reference)) ?? undefined;
    } catch (error) {
      console.warn("[tripay] gagal memeriksa status transaksi", error);
      return {
        status: invoice.status,
        settled: false,
        message: "Status pembayaran belum bisa dicek ke penyedia pembayaran.",
      };
    }
  }
  if (!tx) {
    return {
      status: invoice.status,
      settled: false,
      message: "Transaksi belum ditemukan di Tripay. Coba lagi beberapa saat.",
    };
  }

  const effectiveReference = tx.reference || reference;
  const gateway = gatewayMetadata(tx, effectiveReference);

  if (tx.status !== "paid") {
    if (existing && existing.status !== "paid") {
      db.update(payments)
        .set({
          providerRef: effectiveReference,
          method: tx.paymentMethod || existing.method,
          status: tx.status === "failed" ? "failed" : "pending",
          rawWebhook: {
            source: input.raw ? "callback" : "sync",
            ...(input.raw ?? {}),
            gateway,
          },
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existing.id))
        .run();
    }
    saveGatewayMetadata(invoice, tx, effectiveReference);
    return {
      status: tx.status,
      settled: false,
      message:
        tx.status === "failed"
          ? "Pembayaran online tidak berhasil atau transaksi sudah kedaluwarsa."
          : "Pembayaran belum diterima. Status akan diperbarui otomatis.",
    };
  }

  if (!tripayAmountMatchesInvoice(invoice.amount, tx)) {
    console.warn("[tripay] nominal tidak cocok", {
      invoiceId: invoice.id,
      invoiceAmount: invoice.amount,
      gatewayAmount: tx.amount,
      gatewaySubtotal: tx.amountReceived,
      gatewayFee: tx.feeCustomer,
    });
    saveGatewayMetadata(invoice, tx, effectiveReference);
    return {
      status: "paid",
      settled: false,
      message: "Nominal pembayaran tidak sesuai dengan invoice. Hubungi support.",
    };
  }

  if (invoice.status === "expired") {
    db.update(invoices).set({ status: "unpaid" }).where(eq(invoices.id, invoice.id)).run();
  }

  const result = await settleInvoice({
    invoiceId: invoice.id,
    provider: "tripay",
    providerRef: effectiveReference,
    method: tx.paymentMethod || tx.paymentName || "Tripay",
    paymentId: existing?.id,
    rawWebhook: {
      source: input.raw ? "callback" : "sync",
      ...(input.raw ?? {}),
      gateway,
    },
  });

  saveGatewayMetadata(result.invoice, tx, effectiveReference);

  return {
    status: "paid",
    settled: !result.alreadyPaid,
    message: result.alreadyPaid
      ? "Invoice sudah lunas."
      : "Pembayaran berhasil dikonfirmasi. Layanan akan segera diproses.",
  };
}
