import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, payments } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { reconcileTripayPayment } from "@/server/services/tripay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesi berakhir." }, { status: 401 });
  }

  const { id } = await params;
  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, user.id)))
    .get();
  if (!invoice) {
    return NextResponse.json(
      { ok: false, message: "Invoice tidak ditemukan." },
      { status: 404 },
    );
  }

  let message: string | undefined;
  const canCheck = invoice.status === "unpaid" || invoice.status === "expired";
  if (canCheck) {
    const limit = rateLimit(`invoice-status:${user.id}`, 60, 5 * 60 * 1000);
    if (limit.ok) {
      try {
        const result = await reconcileTripayPayment({ invoice });
        message = result.message;
      } catch (error) {
        console.warn("[tripay] gagal sync status invoice", invoice.id, error);
        message = "Status pembayaran belum dapat diperiksa. Coba lagi sebentar.";
      }
    } else {
      message = `Terlalu banyak pengecekan. Coba lagi dalam ${limit.retryAfterSeconds} detik.`;
    }
  }

  const latest = db
    .select({ status: invoices.status, paidAt: invoices.paidAt })
    .from(invoices)
    .where(eq(invoices.id, invoice.id))
    .get();
  const latestTripayPayment = db
    .select({ status: payments.status })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoice.id), eq(payments.provider, "tripay")))
    .orderBy(desc(payments.createdAt))
    .get();

  return NextResponse.json({
    ok: true,
    status: latest?.status ?? invoice.status,
    paidAt: latest?.paidAt ?? invoice.paidAt,
    paymentStatus: latestTripayPayment?.status ?? null,
    message,
  });
}
