import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  KeyRound,
  Receipt,
  Server,
} from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  balanceTransactions,
  invoices,
  osImages,
  plans,
  regions,
  services,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import {
  cycleLabel,
  formatDateTime,
  formatIDR,
  formatRelative,
  orderStatusLabel,
} from "@/lib/format";
import {
  getOrderForUser,
  provisioningTimeline,
} from "@/server/services/orders";
import { isServiceVisible } from "@/server/services/services";
import { getProvisioningJob } from "@/server/services/provisioning";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { InfoRow, SectionCard } from "@/components/dashboard/section-card";
import { PollRefresh } from "@/components/dashboard/poll-refresh";
import { OrderActions } from "@/components/dashboard/order-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail Pesanan" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const order = getOrderForUser(id, user.id);
  if (!order) notFound();

  const plan = db.select().from(plans).where(eq(plans.id, order.planId)).get();
  const region = db.select().from(regions).where(eq(regions.slug, order.regionSlug)).get();
  const os = db.select().from(osImages).where(eq(osImages.slug, order.osSlug)).get();
  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.orderId, order.id), eq(invoices.userId, user.id)))
    .get();
  const service = db
    .select()
    .from(services)
    .where(and(eq(services.orderId, order.id), eq(services.userId, user.id)))
    .get();
  const refund = db
    .select()
    .from(balanceTransactions)
    .where(
      and(
        eq(balanceTransactions.ref, order.id),
        eq(balanceTransactions.type, "refund"),
      ),
    )
    .get();
  const visibleService =
    service && isServiceVisible(service.status, order.status) ? service : null;
  const job = service ? getProvisioningJob(service.id) : null;
  const timeline = provisioningTimeline(
    order.status,
    job?.step ?? null,
    service?.status ?? null,
  );
  const snapshot = order.priceSnapshot;
  const isWaiting = ["pending_payment", "paid", "provisioning"].includes(order.status);

  return (
    <div className="space-y-6">
      <PollRefresh enabled={isWaiting} intervalMs={7000} />
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Pesanan", href: "/dashboard/pesanan" },
          { label: order.orderNumber },
        ]}
        title={order.orderNumber}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} label={orderStatusLabel[order.status]} />
            <span>Dibuat {formatDateTime(order.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
              <Link href="/dashboard/pesanan">
                <ArrowLeft className="size-4" /> Kembali
              </Link>
            </Button>
            {visibleService ? (
              <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                <Link href={`/dashboard/vps/${visibleService.id}`}>
                  <Server className="size-4" /> Kelola VPS
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {refund ? (
        <div className="rounded-2xl border border-[#BFE3CC] bg-[#F3F9F5] p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-[#0B3D2E]">
            <CheckCircle2 className="size-4 text-[#16A34A]" /> Dana sudah balik ke saldo
          </p>
          <p className="mt-1 text-sm text-[#5B6B60]">
            Refund <strong className="text-[#0B3D2E]">{formatIDR(refund.amount)}</strong> sudah
            ditambahkan ke saldo akunmu.
            {order.errorMessage ? ` Kendala: ${order.errorMessage}` : ""}
          </p>
          <Button asChild size="sm" className="mt-4 bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Link href="/dashboard/saldo">Lihat saldo</Link>
          </Button>
        </div>
      ) : order.status === "failed" ? (
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-[#991B1B]">
            <CircleAlert className="size-4" /> Pembuatan server gagal
          </p>
          <p className="mt-1 text-sm text-[#991B1B]/80">
            {order.errorMessage ??
              "Server belum berhasil dibuat. Kamu bisa coba lagi atau ajukan refund ke saldo."}
          </p>
          <div className="mt-4">
            <OrderActions
              orderId={order.id}
              status={order.status}
              orderNumber={order.orderNumber}
              hasRefund={Boolean(refund)}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Progres pesanan">
            <ol className="grid gap-3 sm:grid-cols-4">
              {timeline.map((step, index) => (
                <li
                  key={step.key}
                  className={cn(
                    "relative rounded-xl border p-3.5",
                    step.done
                      ? "border-[#BFE3CC] bg-[#E7F4EC]"
                      : step.active
                        ? "border-[#FDE68A] bg-[#FFFBEB]"
                        : "border-[#E3E8E4] bg-white",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                      step.done
                        ? "bg-[#16A34A] text-white"
                        : step.active
                          ? "bg-[#D97706] text-white"
                          : "bg-[#F1F3F2] text-[#8A9A90]",
                    )}
                  >
                    {step.done ? <CheckCircle2 className="size-4" /> : index + 1}
                  </span>
                  <p className="mt-2 text-xs font-semibold text-[#101613]">{step.label}</p>
                </li>
              ))}
            </ol>
            {order.status === "pending_payment" ? (
              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm text-[#92400E]">
                  <Clock className="size-4" />
                  Bayar sebelum {formatDateTime(order.expiresAt)}
                </p>
                {invoice ? (
                  <Button asChild size="sm" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                    <Link href={`/dashboard/invoices/${invoice.id}`}>
                      Bayar invoice <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Detail server">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: Globe2, label: "Region", value: region?.name ?? order.regionSlug },
                { icon: Cpu, label: "vCPU", value: `${plan?.vcpus ?? "—"} vCPU` },
                { icon: Database, label: "RAM", value: plan ? `${plan.ramMb / 1024} GB` : "—" },
                { icon: HardDrive, label: "Disk", value: plan ? `${plan.diskGb} GB SSD` : "—" },
                { icon: Server, label: "Hostname", value: order.hostname },
                { icon: KeyRound, label: "Akses", value: order.sshKeyId ? "SSH key" : "Password root" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-3.5">
                  <p className="flex items-center gap-1.5 text-xs text-[#8A9A90]">
                    <item.icon className="size-3.5" /> {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold break-all text-[#101613]">{item.value}</p>
                </div>
              ))}
            </div>
            <dl className="mt-4 divide-y divide-[#EDF1EE]">
              <InfoRow label="Paket" value={plan?.name ?? snapshot.planName} />
              <InfoRow label="Sistem operasi" value={os?.name ?? order.osSlug} />
              <InfoRow label="Siklus" value={cycleLabel[order.billingCycle]} />
              <InfoRow label="Dibayar" value={order.paidAt ? formatDateTime(order.paidAt) : "Belum dibayar"} />
            </dl>
          </SectionCard>

          {visibleService ? (
            <SectionCard
              title="Layanan terkait"
              description="VPS yang dibuat dari pesanan ini."
              action={
                <Button asChild variant="ghost" size="sm" className="text-[#0B3D2E] hover:bg-[#F3F9F5]">
                  <Link href={`/dashboard/vps/${visibleService.id}`}>
                    Buka VPS <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-4">
                <div>
                  <p className="font-mono text-sm font-bold text-[#101613]">{visibleService.hostname}</p>
                  <p className="text-xs text-[#5B6B60]">
                    {visibleService.ipv4 ?? "IP menyusul"} · aktif s/d {formatDateTime(visibleService.periodEnd)}
                  </p>
                </div>
                <StatusBadge status={visibleService.status} label={visibleService.status} />
              </div>
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-6">
          <SectionCard title="Rincian biaya">
            <dl className="divide-y divide-[#EDF1EE]">
              <InfoRow
                label={`${snapshot.planName} (${cycleLabel[snapshot.cycle]})`}
                value={formatIDR(snapshot.subtotal)}
              />
              {snapshot.setupFee > 0 ? <InfoRow label="Biaya setup" value={formatIDR(snapshot.setupFee)} /> : null}
              {snapshot.discount > 0 ? (
                <InfoRow
                  label={`Diskon${snapshot.promoCode ? ` (${snapshot.promoCode})` : ""}`}
                  value={<span className="text-[#15803D]">−{formatIDR(snapshot.discount)}</span>}
                />
              ) : null}
              <InfoRow
                label={<span className="font-bold text-[#101613]">Total</span>}
                value={<span className="text-lg font-bold text-[#0B3D2E]">{formatIDR(snapshot.total)}</span>}
              />
            </dl>
            {invoice ? (
              <Button asChild variant="outline" className="mt-4 w-full border-[#D8E2DB] bg-white">
                <Link href={`/dashboard/invoices/${invoice.id}`}>
                  <Receipt className="size-4" /> Lihat invoice {invoice.invoiceNumber}
                </Link>
              </Button>
            ) : null}
          </SectionCard>

          <SectionCard title="Aksi pesanan">
            {refund ? (
              <p className="text-sm text-[#5B6B60]">
                Pesanan ini sudah direfund ke saldo. Nggak ada aksi lanjutan yang perlu dilakukan.
              </p>
            ) : order.status === "failed" ? (
              <p className="text-sm text-[#5B6B60]">
                Gunakan tombol <strong className="text-[#101613]">Coba buat server lagi</strong> atau{" "}
                <strong className="text-[#101613]">Ajukan refund</strong> pada banner di atas.
              </p>
            ) : ["pending_payment", "cancelled", "expired"].includes(order.status) ? (
              <OrderActions
                orderId={order.id}
                status={order.status}
                orderNumber={order.orderNumber}
                hasRefund={false}
              />
            ) : (
              <p className="text-sm text-[#5B6B60]">
                Pesanan ini sudah diproses. Server bisa kamu kelola dari halaman VPS.
              </p>
            )}
            <div className="mt-4 space-y-2 border-t border-[#EDF1EE] pt-4 text-xs text-[#8A9A90]">
              <p className="flex items-center gap-2">
                <CalendarClock className="size-3.5" /> Kedaluwarsa {formatRelative(order.expiresAt)}
              </p>
              <p>Butuh bantuan? Buka tiket dan sertakan nomor pesanan, ya.</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
