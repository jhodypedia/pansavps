import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Mail,
  Receipt,
  Server,
  UserRound,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, orders, osImages, plans, regions, services, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  cycleLabel,
  formatDateTime,
  formatIDR,
  orderStatusLabel,
  serviceStatusLabel,
} from "@/lib/format";
import { getProvisioningJob } from "@/server/services/provisioning";
import { provisioningTimeline } from "@/server/services/orders";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { InfoRow, SectionCard } from "@/components/dashboard/section-card";
import { AdminOrderActions } from "@/components/dashboard/admin-order-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail Pesanan Admin" };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const order = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) notFound();

  const owner = db.select().from(users).where(eq(users.id, order.userId)).get();
  const plan = db.select().from(plans).where(eq(plans.id, order.planId)).get();
  const region = db.select().from(regions).where(eq(regions.slug, order.regionSlug)).get();
  const os = db.select().from(osImages).where(eq(osImages.slug, order.osSlug)).get();
  const invoice = db.select().from(invoices).where(eq(invoices.orderId, order.id)).get();
  const service = db.select().from(services).where(eq(services.orderId, order.id)).get();
  const job = service ? getProvisioningJob(service.id) : null;
  const timeline = provisioningTimeline(order.status, job?.step ?? null, service?.status ?? null);
  const snapshot = order.priceSnapshot;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Pesanan", href: "/admin/orders" },
          { label: order.orderNumber },
        ]}
        title={order.orderNumber}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} label={orderStatusLabel[order.status]} />
            <span>{formatDateTime(order.createdAt)} · {order.hostname}</span>
          </span>
        }
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/admin/orders">
              <ArrowLeft className="size-4" /> Kembali
            </Link>
          </Button>
        }
      />

      {order.errorMessage ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4">
          <CircleAlert className="mt-0.5 size-5 text-[#DC2626]" />
          <div>
            <p className="text-sm font-bold text-[#991B1B]">Error saat membuat server</p>
            <p className="text-sm text-[#991B1B]/80">{order.errorMessage}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Progres">
            <ol className="grid gap-3 sm:grid-cols-4">
              {timeline.map((step, index) => (
                <li
                  key={step.key}
                  className={cn(
                    "rounded-xl border p-3",
                    step.done
                      ? "border-[#BFE3CC] bg-[#E7F4EC]"
                      : step.active
                        ? "border-[#FDE68A] bg-[#FFFBEB]"
                        : "border-[#E3E8E4] bg-white",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                      step.done ? "bg-[#16A34A] text-white" : step.active ? "bg-[#D97706] text-white" : "bg-[#F1F3F2] text-[#8A9A90]",
                    )}
                  >
                    {step.done ? <CheckCircle2 className="size-3.5" /> : index + 1}
                  </span>
                  <p className="mt-1.5 text-xs font-semibold text-[#101613]">{step.label}</p>
                </li>
              ))}
            </ol>
            {job ? (
              <p className="mt-3 text-xs text-[#8A9A90]">
                Job {job.id} · status {job.status} · langkah {job.step} · percobaan {job.attempts}
                {job.lastError ? ` · error: ${job.lastError}` : ""}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Detail pesanan">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Region", region?.name ?? order.regionSlug],
                ["Paket", plan?.name ?? snapshot.planName],
                ["Sistem operasi", os?.name ?? order.osSlug],
                ["Siklus", cycleLabel[order.billingCycle]],
                ["Hostname", order.hostname],
                ["Akses", order.sshKeyId ? "SSH key" : "Password"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-3">
                  <p className="text-xs text-[#8A9A90]">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold break-all text-[#101613]">{value}</p>
                </div>
              ))}
            </div>
            <dl className="mt-4 divide-y divide-[#EDF1EE]">
              <InfoRow label="Dibuat" value={formatDateTime(order.createdAt)} />
              <InfoRow label="Dibayar" value={order.paidAt ? formatDateTime(order.paidAt) : "Belum"} />
              <InfoRow label="Kedaluwarsa" value={formatDateTime(order.expiresAt)} />
              <InfoRow label="Promo" value={snapshot.promoCode ?? "—"} />
            </dl>
          </SectionCard>

          <SectionCard title="Aksi admin">
            <AdminOrderActions orderId={order.id} status={order.status} />
            <p className="mt-3 text-xs text-[#8A9A90]">
              Refund memindahkan dana ke saldo pengguna dan mencatat audit. Retry membuat proses pembuatan server baru.
            </p>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Pengguna">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#0B3D2E] text-sm font-bold text-white">
                {owner?.name?.[0] ?? "?"}
              </span>
              <div className="min-w-0">
                <Link href={`/admin/users/${owner?.id ?? ""}`} className="truncate text-sm font-bold text-[#0B3D2E] hover:underline">
                  {owner?.name ?? "—"}
                </Link>
                <p className="truncate text-xs text-[#8A9A90]">{owner?.email}</p>
              </div>
            </div>
            <dl className="mt-3 divide-y divide-[#EDF1EE]">
              <InfoRow label="Telepon" value={owner?.phone ?? "—"} />
              <InfoRow label="Saldo" value={formatIDR(owner?.balance ?? 0)} />
              <InfoRow label="Status" value={owner?.status ?? "—"} />
            </dl>
            <div className="mt-3 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1 border-[#D8E2DB] bg-white">
                <a href={`mailto:${owner?.email}`}>
                  <Mail className="size-3.5" /> Email
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1 border-[#D8E2DB] bg-white">
                <Link href={`/admin/users/${owner?.id ?? ""}`}>
                  <UserRound className="size-3.5" /> Profil
                </Link>
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Rincian biaya">
            <dl className="divide-y divide-[#EDF1EE]">
              <InfoRow label="Subtotal" value={formatIDR(snapshot.subtotal)} />
              {snapshot.setupFee > 0 ? <InfoRow label="Setup" value={formatIDR(snapshot.setupFee)} /> : null}
              {snapshot.discount > 0 ? (
                <InfoRow label="Diskon" value={<span className="text-[#15803D]">−{formatIDR(snapshot.discount)}</span>} />
              ) : null}
              <InfoRow label="Total" value={formatIDR(snapshot.total)} />
            </dl>
            {invoice ? (
              <Button asChild variant="outline" className="mt-3 w-full border-[#D8E2DB] bg-white">
                <Link href={`/admin/invoices/${invoice.id}`}>
                  <Receipt className="size-4" /> Invoice {invoice.invoiceNumber}
                </Link>
              </Button>
            ) : null}
          </SectionCard>

          {service ? (
            <SectionCard title="Layanan VPS">
              <dl className="divide-y divide-[#EDF1EE]">
                <InfoRow label="Hostname" value={<span className="font-mono">{service.hostname}</span>} />
                <InfoRow label="Status" value={<StatusBadge status={service.status} label={serviceStatusLabel[service.status]} />} />
                <InfoRow label="IPv4" value={<span className="font-mono">{service.ipv4 ?? "—"}</span>} />
                <InfoRow label="Droplet" value={<span className="font-mono text-xs">{service.doDropletId ?? "—"}</span>} />
              </dl>
              <Button asChild className="mt-3 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                <Link href={`/admin/services/${service.id}`}>
                  <Server className="size-4" /> Kelola layanan <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
