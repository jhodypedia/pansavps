import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { invoices, orders, plans, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatIDR, invoiceStatusLabel, invoiceTypeLabel } from "@/lib/format";
import { getPublicBrand } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) return NextResponse.json({ message: "Invoice tidak ditemukan." }, { status: 404 });
  if (session.role !== "admin" && invoice.userId !== session.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const owner = db.select().from(users).where(eq(users.id, invoice.userId)).get();
  const order = invoice.orderId
    ? db.select().from(orders).where(eq(orders.id, invoice.orderId)).get()
    : null;
  const plan = order ? db.select().from(plans).where(eq(plans.id, order.planId)).get() : null;
  const brand = getPublicBrand();

  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${invoice.invoiceNumber}`);
  doc.setAuthor(brand.siteName);
  doc.setSubject("Invoice");
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const green = rgb(0.043, 0.239, 0.18);
  const text = rgb(0.063, 0.086, 0.075);
  const muted = rgb(0.357, 0.42, 0.376);
  const line = rgb(0.89, 0.91, 0.894);

  page.drawRectangle({ x: 0, y: 761.89, width: 595.28, height: 80, color: green });
  page.drawText(brand.siteName, { x: 48, y: 805, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText(brand.tagline || "Cloud VPS", { x: 48, y: 786, size: 9, font, color: rgb(0.85, 0.92, 0.87) });
  page.drawText("INVOICE", { x: 460, y: 803, size: 20, font: bold, color: rgb(1, 1, 1) });

  let y = 715;
  page.drawText(invoice.invoiceNumber, { x: 48, y, size: 16, font: bold, color: text });
  page.drawText(invoiceStatusLabel[invoice.status] ?? invoice.status, { x: 48, y: y - 18, size: 10, font, color: green });

  page.drawText("DITAGIHKAN KEPADA", { x: 340, y: y + 4, size: 8, font: bold, color: muted });
  page.drawText(owner?.name ?? "—", { x: 340, y: y - 10, size: 10, font: bold, color: text });
  page.drawText(owner?.email ?? "—", { x: 340, y: y - 24, size: 9, font, color: muted });
  if (owner?.phone) page.drawText(`+${owner.phone}`, { x: 340, y: y - 37, size: 9, font, color: muted });

  y -= 70;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });

  y -= 24;
  page.drawText("TANGGAL", { x: 48, y, size: 8, font: bold, color: muted });
  page.drawText("JATUH TEMPO", { x: 190, y, size: 8, font: bold, color: muted });
  page.drawText("TIPE", { x: 332, y, size: 8, font: bold, color: muted });
  page.drawText("DIBAYAR", { x: 440, y, size: 8, font: bold, color: muted });
  y -= 14;
  page.drawText(formatDate(invoice.createdAt), { x: 48, y, size: 9, font, color: text });
  page.drawText(formatDate(invoice.dueDate), { x: 190, y, size: 9, font, color: text });
  page.drawText(invoiceTypeLabel[invoice.type] ?? invoice.type, { x: 332, y, size: 9, font, color: text });
  page.drawText(invoice.paidAt ? formatDate(invoice.paidAt) : "—", { x: 440, y, size: 9, font, color: text });

  y -= 40;
  page.drawRectangle({ x: 48, y: y - 4, width: 499, height: 24, color: rgb(0.969, 0.973, 0.969) });
  page.drawText("DESKRIPSI", { x: 60, y: y + 4, size: 8, font: bold, color: muted });
  page.drawText("NOMINAL", { x: 465, y: y + 4, size: 8, font: bold, color: muted });

  y -= 30;
  const description = plan
    ? `${plan.name}${order ? ` — ${order.hostname} (${order.billingCycle})` : ""}`
    : invoiceTypeLabel[invoice.type] ?? "Layanan";
  page.drawText(description.slice(0, 70), { x: 60, y, size: 10, font, color: text });
  page.drawText(formatIDR(invoice.amount), { x: 465, y, size: 10, font, color: text });

  y -= 26;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
  y -= 24;
  page.drawText("TOTAL", { x: 400, y, size: 9, font: bold, color: muted });
  page.drawText(formatIDR(invoice.amount), { x: 465, y, size: 13, font: bold, color: green });

  if (invoice.notes) {
    y -= 44;
    page.drawText("CATATAN", { x: 48, y, size: 8, font: bold, color: muted });
    const notes = invoice.notes.slice(0, 200);
    page.drawText(notes, { x: 48, y: y - 14, size: 9, font, color: text, maxWidth: 480, lineHeight: 13 });
  }

  page.drawLine({ start: { x: 48, y: 96 }, end: { x: 547, y: 96 }, thickness: 1, color: line });
  page.drawText(`${brand.siteName} · ${brand.supportEmail} · WhatsApp +${brand.supportWhatsapp}`, {
    x: 48,
    y: 78,
    size: 8,
    font,
    color: muted,
  });
  page.drawText(`Dibuat ${formatDateTime(new Date())}`, { x: 48, y: 64, size: 8, font, color: muted });
  page.drawText("Dokumen ini dihasilkan otomatis dan sah tanpa tanda tangan.", {
    x: 48,
    y: 50,
    size: 8,
    font,
    color: muted,
  });

  const bytes = await doc.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
