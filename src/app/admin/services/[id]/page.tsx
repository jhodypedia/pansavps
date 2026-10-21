import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Box,
  Cable,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  Server,
  UserRound,
} from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, invoices, osImages, plans, regions, services, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  cycleLabel,
  formatDate,
  formatDateTime,
  formatIDR,
  formatRelative,
  invoiceStatusLabel,
  serviceStatusLabel,
} from "@/lib/format";
import { getProvisioningJob } from "@/server/services/provisioning";
import { listSnapshots, serviceActionHistory } from "@/server/services/services";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { InfoRow, SectionCard } from "@/components/dashboard/section-card";
import {
  AdminRevealPassword,
  AdminServiceQuickActions,
  AdminTerminateDialog,
} from "@/components/dashboard/admin-service-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail Layanan Admin" };

export default async function AdminServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const service = db.select().from(services).where(eq(services.id, id)).get();
  if (!service) notFound();

  const owner = db.select().from(users).where(eq(users.id, service.userId)).get();
  const plan = db.select().from(plans).where(eq(plans.id, service.planId)).get();
  const region = db.select().from(regions).where(eq(regions.slug, service.regionSlug)).get();
  const os = db.select().from(osImages).where(eq(osImages.slug, service.osSlug)).get();
  const history = serviceActionHistory(service.id);
  const snapshots = listSnapshots(service.id);
  const job = getProvisioningJob(service.id);
  const invoicesRows = db
    .select()
    .from(invoices)
    .where(eq(invoices.serviceId, service.id))
    .orderBy(desc(invoices.createdAt))
    .all();
  const audits = db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entity, "service"), eq(auditLogs.entityId, service.id)))
    .orderBy(desc(auditLogs.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Layanan", href: "/admin/services" },
          { label: service.hostname },
        ]}
        title={service.hostname}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={service.status} label={serviceStatusLabel[service.status]} />
            <span>{plan?.name ?? "—"} · {region?.name ?? service.regionSlug} · {service.ipv4 ?? "IP menyusul"}</span>
          </span>
        }
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/admin/services">
              <ArrowLeft className="size-4" /> Kembali
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Aksi cepat">
            <AdminServiceQuickActions serviceId={service.id} status={service.status} />
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[#EDF1EE] pt-3">
              <AdminRevealPassword serviceId={service.id} />
              <AdminTerminateDialog serviceId={service.id} hostname={service.hostname} />
            </div>
          </SectionCard>

          <SectionCard title="Spesifikasi">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: Cpu, label: "vCPU", value: `${plan?.vcpus ?? "—"} vCPU` },
                { icon: Database, label: "RAM", value: plan ? `${plan.ramMb / 1024} GB` : "—" },
                { icon: HardDrive, label: "Disk", value: plan ? `${plan.diskGb} GB` : "—" },
                { icon: Globe2, label: "Region", value: region?.name ?? service.regionSlug },
                { icon: Server, label: "OS", value: os?.name ?? service.osSlug },
                { icon: Cable, label: "Size", value: service.sizeSlug },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-3">
                  <p className="flex items-center gap-1.5 text-xs text-[#8A9A90]">
                    <item.icon className="size-3.5" /> {item.label}
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold break-all text-[#101613]">{item.value}</p>
                </div>
              ))}
            </div>
            <dl className="mt-4 divide-y divide-[#EDF1EE]">
              <InfoRow label="Droplet ID" value={<span className="font-mono text-xs">{service.doDropletId ?? "—"}</span>} />
              <InfoRow label="IPv6" value={<span className="font-mono text-xs">{service.ipv6 ?? "—"}</span>} />
              <InfoRow label="Dibuat" value={formatDateTime(service.createdAt)} />
              <InfoRow label="Masa aktif" value={`${formatDate(service.periodStart)} — ${formatDate(service.periodEnd)}`} />
              <InfoRow label="Siklus" value={cycleLabel[service.billingCycle]} />
              <InfoRow
                label="Auto renew"
                value={service.billingCycle === "weekly" ? "Dihapus otomatis" : service.autoRenew ? "Aktif" : "Nonaktif"}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Riwayat aksi" bodyClassName="p-0">
            {history.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#5B6B60]">Belum ada aksi.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {history.slice(0, 15).map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.resultStatus === "success" ? "bg-[#16A34A]" : "bg-[#DC2626]")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#101613]">
                        {item.action.replaceAll("_", " ")} <span className="text-xs font-normal text-[#8A9A90]">· {item.actor}</span>
                      </p>
                      <p className="text-sm text-[#5B6B60]">{item.message}</p>
                    </div>
                    <span className="text-xs text-[#8A9A90]">{formatRelative(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Snapshot" bodyClassName="p-0">
            {snapshots.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#5B6B60]">Belum ada snapshot.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {snapshots.map((snapshot) => (
                  <li key={snapshot.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Box className="size-4 text-[#8A9A90]" />
                      <div>
                        <p className="text-sm font-semibold text-[#101613]">{snapshot.name}</p>
                        <p className="text-xs text-[#8A9A90]">{formatDateTime(snapshot.createdAt)}</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-[#8A9A90]">{snapshot.doSnapshotId}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Pemilik">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#0B3D2E] text-sm font-bold text-white">
                {owner?.name?.[0] ?? "?"}
              </span>
              <div className="min-w-0">
                <Link href={`/admin/users/${owner?.id ?? ""}`} className="text-sm font-bold text-[#0B3D2E] hover:underline">
                  {owner?.name ?? "—"}
                </Link>
                <p className="truncate text-xs text-[#8A9A90]">{owner?.email}</p>
              </div>
            </div>
            <dl className="mt-3 divide-y divide-[#EDF1EE]">
              <InfoRow label="Telepon" value={owner?.phone ?? "—"} />
              <InfoRow label="Saldo" value={formatIDR(owner?.balance ?? 0)} />
              <InfoRow label="Status akun" value={owner?.status ?? "—"} />
            </dl>
            <Button asChild variant="outline" className="mt-3 w-full border-[#D8E2DB] bg-white">
              <Link href={`/admin/users/${owner?.id ?? ""}`}>
                <UserRound className="size-4" /> Buka profil
              </Link>
            </Button>
          </SectionCard>

          <SectionCard title="Provisioning">
            {job ? (
              <dl className="divide-y divide-[#EDF1EE]">
                <InfoRow label="Job ID" value={<span className="font-mono text-xs">{job.id}</span>} />
                <InfoRow label="Status" value={<StatusBadge status={job.status} label={job.status} />} />
                <InfoRow label="Langkah" value={String(job.step)} />
                <InfoRow label="Percobaan" value={String(job.attempts)} />
                {job.lastError ? <InfoRow label="Error" value={<span className="text-xs text-[#B91C1C]">{job.lastError}</span>} /> : null}
              </dl>
            ) : (
              <p className="text-sm text-[#5B6B60]">Tidak ada job provisioning aktif.</p>
            )}
          </SectionCard>

          <SectionCard title="Invoice terkait" bodyClassName="p-0">
            {invoicesRows.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-[#5B6B60]">Belum ada invoice.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {invoicesRows.slice(0, 6).map((invoice) => (
                  <li key={invoice.id}>
                    <Link href={`/admin/invoices/${invoice.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#FBFCFB]">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#0B3D2E]">{invoice.invoiceNumber}</p>
                        <p className="text-[11px] text-[#8A9A90]">{formatDateTime(invoice.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#101613]">{formatIDR(invoice.amount)}</p>
                        <StatusBadge status={invoice.status} label={invoiceStatusLabel[invoice.status]} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Audit terbaru" bodyClassName="p-0">
            {audits.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-[#5B6B60]">Belum ada audit.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {audits.slice(0, 6).map((log) => (
                  <li key={log.id} className="px-5 py-3">
                    <p className="text-sm font-semibold text-[#101613]">{log.action.replaceAll("_", " ")}</p>
                    <p className="text-xs text-[#8A9A90]">
                      {log.actorEmail ?? "system"} · {formatRelative(log.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
