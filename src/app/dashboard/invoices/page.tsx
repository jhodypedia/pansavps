import Link from "next/link";
import { ArrowRight, FileText, Receipt, Wallet } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, orders } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import {
  formatDateTime,
  formatIDR,
  formatRelative,
  invoiceStatusLabel,
  invoiceTypeLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Invoice" };

const filters = [
  { key: "all", label: "Semua" },
  { key: "unpaid", label: "Belum dibayar" },
  { key: "paid", label: "Lunas" },
  { key: "expired", label: "Kedaluwarsa" },
  { key: "cancelled", label: "Dibatalkan" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status } = await searchParams;
  const filter = filters.some((item) => item.key === status) ? status! : "all";
  const all = db
    .select()
    .from(invoices)
    .where(eq(invoices.userId, user.id))
    .orderBy(desc(invoices.createdAt))
    .all();
  const rows = filter === "all" ? all : all.filter((invoice) => invoice.status === filter);
  const orderRows = db.select().from(orders).where(eq(orders.userId, user.id)).all();
  const orderMap = new Map(orderRows.map((order) => [order.id, order]));
  const unpaidTotal = all
    .filter((invoice) => invoice.status === "unpaid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const paidTotal = all
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice"
        description="Semua tagihan pesanan, perpanjangan, upgrade, dan top up saldo."
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/dashboard/saldo">
              <Wallet className="size-4" /> Top up saldo
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Belum dibayar" value={formatIDR(unpaidTotal)} icon={Receipt} tone={unpaidTotal ? "warning" : "default"} />
        <StatCard label="Total lunas" value={formatIDR(paidTotal)} icon={FileText} />
        <StatCard label="Saldo tersedia" value={formatIDR(user.balance)} icon={Wallet} tone="mint" href="/dashboard/saldo" />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => {
          const count =
            item.key === "all"
              ? all.length
              : all.filter((invoice) => invoice.status === item.key).length;
          return (
            <Link
              key={item.key}
              href={item.key === "all" ? "/dashboard/invoices" : `/dashboard/invoices?status=${item.key}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === item.key
                  ? "border-[#0B3D2E] bg-[#0B3D2E] text-white"
                  : "border-[#E3E8E4] bg-white text-[#5B6B60] hover:border-[#BFE3CC] hover:text-[#0B3D2E]",
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold",
                  filter === item.key ? "bg-white/15 text-white" : "bg-[#F1F3F2] text-[#5B6B60]",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filter === "all" ? "Belum ada invoice" : "Tidak ada invoice dengan status ini"}
          description="Invoice akan muncul setelah kamu memesan VPS, memperpanjang layanan, atau melakukan top up."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <th className="px-4 py-2.5">Invoice</th>
                  <th className="px-4 py-2.5">Jenis</th>
                  <th className="px-4 py-2.5">Nominal</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Jatuh tempo</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => {
                  const order = invoice.orderId ? orderMap.get(invoice.orderId) : null;
                  return (
                    <tr key={invoice.id} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#FBFCFB]">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/invoices/${invoice.id}`} className="font-mono text-xs font-semibold text-[#0B3D2E] hover:underline">
                          {invoice.invoiceNumber}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-[#8A9A90]">
                          {invoice.metadata && typeof invoice.metadata.planName === "string"
                            ? invoice.metadata.planName
                            : order?.priceSnapshot.planName ?? formatDateTime(invoice.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[#5B6B60]">{invoiceTypeLabel[invoice.type]}</td>
                      <td className="px-4 py-3 font-semibold text-[#101613]">{formatIDR(invoice.amount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} label={invoiceStatusLabel[invoice.status]} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5B6B60]">
                        {invoice.status === "unpaid" ? (
                          <>
                            {formatDateTime(invoice.dueDate)}
                            <span className="mt-0.5 block text-[#8A9A90]">{formatRelative(invoice.dueDate)}</span>
                          </>
                        ) : (
                          formatDateTime(invoice.paidAt ?? invoice.createdAt)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          asChild
                          variant={invoice.status === "unpaid" ? "default" : "ghost"}
                          size="sm"
                          className={
                            invoice.status === "unpaid"
                              ? "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
                              : "text-[#0B3D2E] hover:bg-[#F3F9F5]"
                          }
                        >
                          <Link href={`/dashboard/invoices/${invoice.id}`}>
                            {invoice.status === "unpaid" ? "Bayar" : "Lihat"} <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
