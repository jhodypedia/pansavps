import Link from "next/link";
import { ArrowRight, Plus, ShoppingCart } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import {
  cycleLabel,
  formatDateTime,
  formatIDR,
  orderStatusLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pesanan" };

const filters = [
  { key: "all", label: "Semua" },
  { key: "pending_payment", label: "Menunggu bayar" },
  { key: "provisioning", label: "Diproses" },
  { key: "active", label: "Aktif" },
  { key: "failed", label: "Gagal" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status } = await searchParams;
  const filter = filters.some((item) => item.key === status) ? status! : "all";
  const all = db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .all();
  const rows = filter === "all" ? all : all.filter((order) => order.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesanan"
        description="Riwayat pesanan VPS, status pembayaran, dan proses provisioning."
        actions={
          <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Link href="/dashboard/pesanan/baru">
              <Plus className="size-4" /> Pesan VPS
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => {
          const count =
            item.key === "all"
              ? all.length
              : all.filter((order) => order.status === item.key).length;
          return (
            <Link
              key={item.key}
              href={item.key === "all" ? "/dashboard/pesanan" : `/dashboard/pesanan?status=${item.key}`}
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
          icon={ShoppingCart}
          title={filter === "all" ? "Belum ada pesanan" : "Tidak ada pesanan dengan status ini"}
          description="Pesanan VPS pertamamu akan muncul di sini beserta status pembayaran dan provisioning."
          action={
            <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href="/dashboard/pesanan/baru">
                <Plus className="size-4" /> Pesan VPS sekarang
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <th className="px-4 py-2.5">Pesanan</th>
                  <th className="px-4 py-2.5">Paket</th>
                  <th className="px-4 py-2.5">Siklus</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Dibuat</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#FBFCFB]">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-[#101613]">{order.orderNumber}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#8A9A90]">{order.hostname}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#101613]">{order.priceSnapshot.planName}</td>
                    <td className="px-4 py-3 text-[#5B6B60]">{cycleLabel[order.billingCycle]}</td>
                    <td className="px-4 py-3 font-semibold text-[#101613]">{formatIDR(order.priceSnapshot.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} label={orderStatusLabel[order.status]} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6B60]">{formatDateTime(order.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm" className="text-[#0B3D2E] hover:bg-[#F3F9F5]">
                        <Link href={`/dashboard/pesanan/${order.id}`}>
                          Detail <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
