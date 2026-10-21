import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { normalizeTripayTransaction, verifyTripaySignature } from "@/lib/payments/tripay";
import { reconcileTripayPayment } from "@/server/services/tripay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TripayBody = { event?: string; data?: Record<string, unknown> };

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-callback-signature") ?? "";

  if (!verifyTripaySignature(raw, signature)) {
    return NextResponse.json({ ok: false, message: "Signature tidak valid." }, { status: 401 });
  }

  let body: TripayBody;
  try {
    body = JSON.parse(raw) as TripayBody;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload tidak valid." }, { status: 400 });
  }

  const data = body.data;
  const merchantRef = typeof data?.merchant_ref === "string" ? data.merchant_ref.trim() : "";
  if (!data || !merchantRef) {
    return NextResponse.json(
      { ok: false, message: "Data transaksi tidak lengkap." },
      { status: 400 },
    );
  }

  const invoice = db
    .select()
    .from(invoices)
    .where(eq(invoices.invoiceNumber, merchantRef))
    .get();
  if (!invoice) {
    return NextResponse.json({ ok: false, message: "Invoice tidak ditemukan." }, { status: 404 });
  }

  try {
    const transaction = normalizeTripayTransaction(
      data,
      body as unknown as Record<string, unknown>,
    );
    const result = await reconcileTripayPayment({
      invoice,
      transaction,
      raw: body as unknown as Record<string, unknown>,
    });

    // Callback bertanda tangan tetap dibalas 200 agar Tripay tidak mengirim
    // ulang tanpa henti. Jika nominal tidak cocok, admin dapat meninjaunya.
    return NextResponse.json({
      ok: true,
      status: result.status,
      settled: result.settled,
      message: result.message,
    });
  } catch (error) {
    console.error("[tripay] gagal memproses callback", error);
    return NextResponse.json(
      { ok: false, message: "Gagal memproses pembayaran." },
      { status: 500 },
    );
  }
}
