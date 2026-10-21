import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  CreditCard,
  PlayCircle,
  Receipt,
  Server,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  invoices,
  jobs,
  orders,
  payments,
  plans,
  services,
  users,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  formatDateShort,
  formatDateTime,
  formatIDR,
  formatIDRShort,
  formatRelative,
  orderStatusLabel,
} from "@/lib/format";
import { runCronAction } from "@/server/actions/admin";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { ActionButton } from "@/components/dashboard/action-button";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ringkasan Admin" };

export default async function AdminOverviewPage() {
  await requireAdmin();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const allInvoices = db.select().from(invoices).all();
  const paid = allInvoices.filter((invoice) => invoice.status === "paid");
  const revenueMonth = paid
    .filter((invoice) => invoice.paidAt && invoice.paidAt >= startOfMonth)
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const revenueTotal = paid.reduce((sum, invoice) => sum + invoice.amount, 0);
  const unpaidTotal = allInvoices
    .filter((invoice) => invoice.status === "unpaid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const userRows = db.select().from(users).all();
  const serviceRows = db.select().from(services).all();
  const orderRows = db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(20)
    .all();
  const planRows = db.select().from(plans).all();
  const planMap = new Map(planRows.map((plan) => [plan.id, plan]));
  const userMap = new Map(userRows.map((user) => [user.id, user]));

  const pendingPayments = db.select().from(payments).where(eq(payments.status, "pending")).all();
  const failedJobs = db.select().from(jobs).where(eq(jobs.status, "failed")).all();
  const queuedJobs = db.select().from(jobs).where(eq(jobs.status, "queued")).all();

  const chartData = Array.from({ length: 14 }).map((_, index) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (13 - index));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const dayInvoices = paid.filter(
      (invoice) => invoice.paidAt && invoice.paidAt >= day && invoice.paidAt < next,
    );
    return {
      label: formatDateShort(day).slice(0, 6),
      revenue: dayInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      orders: dayInvoices.length,
    };
  });

  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiring = serviceRows
    .filter(
      (service) =>
        service.status === "active" &&
        service.periodEnd &&
        service.periodEnd <= soon &&
        service.periodEnd >= now,
    )
    .sort((a, b) => (a.periodEnd?.getTime() ?? 0) - (b.periodEnd?.getTime() ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan operasional"
        description="Pantau pendapatan, pesanan, provisioning, dan kondisi layanan."
        actions={
          <>
            <ActionButton
              action={runCronAction}
              variant="outline"
              className="border-[#D8E2DB] bg-white"
            >
              <PlayCircle className="size-3.5" /> Jalankan cron
            </ActionButton>
            <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href="/admin/payments">
                <CreditCard className="size-4" /> Verifikasi pembayaran
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendapatan bulan ini"
          value={formatIDRShort(revenueMonth)}
          hint={`Total ${formatIDRShort(revenueTotal)}`}
          icon={TrendingUp}
          tone="brand"
        />
        <StatCard
          label="Pesanan bulan ini"
          value={orderRows.filter((order) => order.createdAt >= startOfMonth).length}
          hint={`${orderRows.length} pesanan terbaru dimuat`}
          icon={ShoppingCart}
          href="/admin/orders"
        />
        <StatCard
          label="VPS aktif"
          value={serviceRows.filter((service) => service.status === "active").length}
          hint={`${serviceRows.length} total layanan`}
          icon={Server}
          href="/admin/services"
        />
        <StatCard
          label="Pengguna"
          value={userRows.length}
          hint={`${userRows.filter((user) => user.role === "admin").length} admin`}
          icon={Users}
          href="/admin/users"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <SectionCard title="Pendapatan 14 hari" description="Invoice lunas per hari.">
          <RevenueChart data={chartData} />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Perlu tindakan" bodyClassName="p-0">
            <ul className="divide-y divide-[#EDF1EE]">
              <li>
                <Link href="/admin/payments" className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FBFCFB]">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#92400E]">
                    <CreditCard className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#101613]">Bukti pembayaran menunggu</p>
                    <p className="text-xs text-[#8A9A90]">{pendingPayments.length} pembayaran perlu diverifikasi</p>
                  </div>
                  <ArrowRight className="size-4 text-[#8A9A90]" />
                </Link>
              </li>
              <li>
                <Link href="/admin/orders?status=failed" className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FBFCFB]">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#991B1B]">
                    <AlertTriangle className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#101613]">Provisioning gagal</p>
                    <p className="text-xs text-[#8A9A90]">{failedJobs.length} job gagal · {queuedJobs.length} antre</p>
                  </div>
                  <ArrowRight className="size-4 text-[#8A9A90]" />
                </Link>
              </li>
              <li>
                <Link href="/admin/invoices?status=unpaid" className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FBFCFB]">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                    <Receipt className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#101613]">Invoice belum dibayar</p>
                    <p className="text-xs text-[#8A9A90]">{formatIDR(unpaidTotal)} tertunda</p>
                  </div>
                  <ArrowRight className="size-4 text-[#8A9A90]" />
                </Link>
              </li>
              <li>
                <Link href="/admin/services?status=provisioning" className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FBFCFB]">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#1E40AF]">
                    <Clock className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#101613]">Layanan disiapkan</p>
                    <p className="text-xs text-[#8A9A90]">
                      {serviceRows.filter((service) => service.status === "provisioning").length} VPS dalam antrean
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-[#8A9A90]" />
                </Link>
              </li>
            </ul>
          </SectionCard>

          <SectionCard title="Segera jatuh tempo" description="7 hari ke depan." bodyClassName="p-0">
            {expiring.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#5B6B60]">Tidak ada layanan yang segera jatuh tempo.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {expiring.slice(0, 4).map((service) => {
                  const owner = userMap.get(service.userId);
                  return (
                    <li key={service.id}>
                      <Link href={`/admin/services/${service.id}`} className="block px-5 py-3 hover:bg-[#FBFCFB]">
                        <p className="text-sm font-semibold text-[#101613]">{service.hostname}</p>
                        <p className="text-xs text-[#8A9A90]">
                          {owner?.name ?? "—"} · {formatDateTime(service.periodEnd)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Pesanan terbaru"
        description="20 pesanan terakhir."
        action={
          <Button asChild variant="ghost" size="sm" className="text-[#0B3D2E] hover:bg-[#F3F9F5]">
            <Link href="/admin/orders">
              Semua pesanan <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                <th className="px-4 py-2.5">Pesanan</th>
                <th className="px-4 py-2.5">Pengguna</th>
                <th className="px-4 py-2.5">Paket</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {orderRows.slice(0, 8).map((order) => {
                const owner = userMap.get(order.userId);
                const plan = planMap.get(order.planId);
                return (
                  <tr key={order.id} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#FBFCFB]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs font-semibold text-[#0B3D2E] hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#101613]">{owner?.name ?? "—"}</p>
                      <p className="text-xs text-[#8A9A90]">{owner?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[#5B6B60]">{plan?.name ?? order.priceSnapshot.planName}</td>
                    <td className="px-4 py-3 font-semibold text-[#101613]">{formatIDR(order.priceSnapshot.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} label={orderStatusLabel[order.status]} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8A9A90]">{formatRelative(order.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
