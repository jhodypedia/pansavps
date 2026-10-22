import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Plus,
  Receipt,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, orders } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatIDR, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { InvoiceList, type InvoiceListItem } from "@/components/dashboard/invoice-list";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export const metadata = { title: "Invoice" };

export default async function InvoicesPage() {
  const user = await requireUser();
  const all = db
    .select()
    .from(invoices)
    .where(eq(invoices.userId, user.id))
    .orderBy(desc(invoices.createdAt))
    .all();
  const orderRows = db.select().from(orders).where(eq(orders.userId, user.id)).all();
  const orderMap = new Map(orderRows.map((order) => [order.id, order]));

  const unpaid = all.filter((invoice) => invoice.status === "unpaid");
  const unpaidTotal = unpaid.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paidTotal = all
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const refundedTotal = all
    .filter((invoice) => invoice.status === "refunded")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const nearestUnpaid = [...unpaid].sort((a, b) => {
    const aDue = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  })[0];

  const items: InvoiceListItem[] = all.map((invoice) => {
    const order = invoice.orderId ? orderMap.get(invoice.orderId) : null;
    const metadata = invoice.metadata ?? {};
    const planName =
      typeof metadata.planName === "string"
        ? metadata.planName
        : order?.priceSnapshot.planName ?? null;
    const tripay =
      metadata.tripay && typeof metadata.tripay === "object" && !Array.isArray(metadata.tripay)
        ? (metadata.tripay as Record<string, unknown>)
        : null;
    const gatewayStatus =
      typeof tripay?.status === "string" ? tripay.status.trim().toUpperCase() : null;
    const displayStatus =
      invoice.status === "unpaid" && gatewayStatus === "FAILED"
        ? "failed"
        : invoice.status === "unpaid" && gatewayStatus === "EXPIRED"
          ? "expired"
          : invoice.status;

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      type: invoice.type,
      status: displayStatus,
      rawStatus: invoice.status,
      amount: invoice.amount,
      createdAt: invoice.createdAt.toISOString(),
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      planName,
      orderNumber: order?.orderNumber ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice"
        description="Semua tagihan pesanan, perpanjangan, upgrade, dan top up saldo dalam satu tempat."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
              <Link href="/dashboard/saldo">
                <Wallet className="size-4" /> Top up saldo
              </Link>
            </Button>
            <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href="/dashboard/pesanan/baru">
                <Plus className="size-4" /> Pesan VPS
              </Link>
            </Button>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-3xl border border-[#0B3D2E] bg-[#06231A] text-white shadow-[0_28px_80px_-48px_rgba(11,61,46,0.9)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(to bottom right, black, transparent 85%)",
            WebkitMaskImage: "linear-gradient(to bottom right, black, transparent 85%)",
          }}
          aria-hidden
        />
        <div className="relative p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                <Receipt className="size-3.5 text-[#86EFAC]" /> Ringkasan tagihan
              </span>
              <p className="mt-4 text-xs font-medium tracking-wide text-white/55 uppercase">
                Total menunggu pembayaran
              </p>
              <p className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">
                {unpaidTotal > 0 ? formatIDR(unpaidTotal) : "Semua lunas"}
              </p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/65">
                {unpaid.length > 0
                  ? `${unpaid.length} invoice menunggu pembayaran.${
                      nearestUnpaid?.dueDate
                        ? ` Tagihan terdekat jatuh tempo ${formatDateTime(nearestUnpaid.dueDate)} (${formatRelative(nearestUnpaid.dueDate)}).`
                        : " Buka invoice untuk melihat detail pembayaran."
                    }`
                  : "Tidak ada tagihan aktif. Semua invoice sudah selesai dan saldo kamu siap dipakai."}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {nearestUnpaid ? (
                  <Button asChild className="bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
                    <Link href={`/dashboard/invoices/${nearestUnpaid.id}`}>
                      Bayar tagihan <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild className="bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
                    <Link href="/dashboard/pesanan/baru">
                      Pesan VPS <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}
                <Button
                  asChild
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/dashboard/saldo">
                    <Wallet className="size-4" /> Top up saldo
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Total lunas" value={formatIDR(paidTotal)} icon={CheckCircle2} />
              <MiniStat label="Dana refund" value={formatIDR(refundedTotal)} icon={RotateCcw} />
              <MiniStat label="Saldo tersedia" value={formatIDR(user.balance)} icon={Wallet} />
              <MiniStat label="Total invoice" value={`${all.length} tagihan`} icon={FileText} />
            </div>
          </div>
        </div>
      </section>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Receipt className="size-4 text-[#0B3D2E]" /> Daftar invoice
          </span>
        }
        description="Cari, filter, dan buka detail tagihan. Status diperbarui otomatis setelah pembayaran diverifikasi."
        action={
          <span className="rounded-full border border-[#E3E8E4] bg-[#F7F8F7] px-3 py-1 text-xs font-semibold text-[#5B6B60]">
            {all.length} invoice
          </span>
        }
        bodyClassName="p-0"
      >
        <InvoiceList items={items} />
      </SectionCard>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-sm">
      <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-[#86EFAC]">
        <Icon className="size-4" />
      </span>
      <p className="mt-2.5 text-[11px] font-medium text-white/55">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
