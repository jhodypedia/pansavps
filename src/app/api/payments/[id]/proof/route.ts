import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, payments } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payment = db.select().from(payments).where(eq(payments.id, id)).get();
  if (!payment || !payment.proofUrl) {
    return NextResponse.json({ message: "Bukti pembayaran tidak ditemukan." }, { status: 404 });
  }
  const invoice = db.select().from(invoices).where(eq(invoices.id, payment.invoiceId)).get();
  if (!invoice) return NextResponse.json({ message: "Invoice tidak ditemukan." }, { status: 404 });
  if (user.role !== "admin" && invoice.userId !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!/^proofs\/[A-Za-z0-9_.-]+$/.test(payment.proofUrl)) {
    return NextResponse.json({ message: "Path tidak valid." }, { status: 400 });
  }
  const root = path.join(process.cwd(), "data", "uploads");
  const filePath = path.resolve(root, payment.proofUrl);
  if (!filePath.startsWith(path.resolve(root) + path.sep)) {
    return NextResponse.json({ message: "Path tidak valid." }, { status: 400 });
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = payment.proofUrl.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentTypes[ext] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="bukti-${payment.id}.${ext}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ message: "File bukti tidak tersedia." }, { status: 404 });
  }
}
