import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  formatDateTime,
  formatIDR,
  invoiceStatusLabel,
  invoiceTypeLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Invoice Admin" };

const filters = [
  { key: "all", label: "Semua" },
  { key: "unpaid", label: "Belum dibayar" },
  { key: "paid", label: "Lunas" },
  { key: "expired", label: "Kedaluwarsa" },
  { key: "cancelled", label: "Dibatalkan" },
  { key: "refunded", label: "Refund" },
];

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const filter = filters.some((item) => item.key === status) ? status! : "all";
  const search = (q ?? "").trim().toLowerCase();
  const all = db.select().from(invoices).orderBy(desc(invoices.createdAt)).all();
  const userRows = db.select().from(users).all();
  const userMap = new Map(userRows.map((user) => [user.id, user]));
  const rows = all.filter((invoice) => {
    if (filter !== "all" && invoice.status !== filter) return false;
    if (!search) return true;
    const owner = userMap.get(invoice.userId);
    return [invoice.invoiceNumber, owner?.name, owner?.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice"
        description="Semua tagihan, status pembayaran, dan verifikasi."
        actions={<ExportCsvButton type="invoices" />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => {
            const count = item.key === "all" ? all.length : all.filter((invoice) => invoice.status === item.key).length;
            return (
              <Link
                key={item.key}
                href={item.key === "all" ? "/admin/invoices" : `/admin/invoices?status=${item.key}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  filter === item.key
                    ? "border-[#0B3D2E] bg-[#0B3D2E] text-white"
                    : "border-[#E3E8E4] bg-white text-[#5B6B60] hover:border-[#BFE3CC] hover:text-[#0B3D2E]",
                )}
              >
                {item.label}
                <span className={cn("rounded-full px-1.5 text-[10px]", filter === item.key ? "bg-white/15" : "bg-[#F1F3F2]")}>
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
        <form className="flex gap-2" action="/admin/invoices">
          {filter !== "all" ? <input type="hidden" name="status" value={filter} /> : null}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari invoice atau pengguna…"
            className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm sm:w-64"
          />
          <Button type="submit" variant="outline" className="border-[#D8E2DB] bg-white">
            Cari
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Receipt} title="Tidak ada invoice" description="Invoice yang cocok dengan filter akan muncul di sini." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <th className="px-4 py-2.5">Invoice</th>
                  <th className="px-4 py-2.5">Pengguna</th>
                  <th className="px-4 py-2.5">Jenis</th>
                  <th className="px-4 py-2.5">Nominal</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Dibuat</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => {
                  const owner = userMap.get(invoice.userId);
                  return (
                    <tr key={invoice.id} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#FBFCFB]">
                      <td className="px-4 py-3">
                        <Link href={`/admin/invoices/${invoice.id}`} className="font-mono text-xs font-semibold text-[#0B3D2E] hover:underline">
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#101613]">{owner?.name ?? "—"}</p>
                        <p className="text-xs text-[#8A9A90]">{owner?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#5B6B60]">{invoiceTypeLabel[invoice.type]}</td>
                      <td className="px-4 py-3 font-semibold text-[#101613]">{formatIDR(invoice.amount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} label={invoiceStatusLabel[invoice.status]} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8A9A90]">{formatDateTime(invoice.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm" className="text-[#0B3D2E] hover:bg-[#F3F9F5]">
                          <Link href={`/admin/invoices/${invoice.id}`}>
                            Detail <ArrowRight className="size-3.5" />
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
