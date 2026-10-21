import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Box,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  History,
  KeyRound,
  Network,
  Receipt,
  Server,
  Terminal,
} from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, osImages, plans, regions } from "@/lib/db/schema";
import { isUserVerified, requireUser } from "@/lib/auth";
import {
  cycleLabel,
  cyclePriceUnit,
  formatDate,
  formatDateTime,
  formatIDR,
  formatRelative,
  serviceStatusLabel,
} from "@/lib/format";
import { cycleUnitPrice } from "@/lib/pricing";
import { availableProviders } from "@/lib/payments";
import { listTripayChannels } from "@/lib/payments/tripay";
import { serviceActionAction } from "@/server/actions/services";
import {
  getVisibleServiceForUser,
  listSnapshots,
  serviceActionHistory,
} from "@/server/services/services";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { InfoRow, SectionCard } from "@/components/dashboard/section-card";
import { ProvisioningProgress } from "@/components/dashboard/provisioning-progress";
import { ActionForm } from "@/components/dashboard/action-form";
import {
  AutoRenewToggle,
  DeleteSnapshotButton,
  QuickPowerActions,
  RebuildDialog,
  RenewServiceDialog,
  RenameDialog,
  ResetPasswordButton,
  RevealPassword,
  SnapshotDialog,
  UpgradeServiceDialog,
} from "@/components/dashboard/service-controls";
import { VerificationRequired } from "@/components/dashboard/verification-required";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail VPS" };

const tabs = [
  { key: "ringkasan", label: "Ringkasan", icon: Server },
  { key: "akses", label: "Akses", icon: KeyRound },
  { key: "aksi", label: "Aksi", icon: Terminal },
  { key: "snapshot", label: "Snapshot", icon: Box },
  { key: "riwayat", label: "Riwayat", icon: History },
];

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = tabs.some((item) => item.key === tabParam) ? tabParam! : "ringkasan";
  const verified = isUserVerified(user);

  const service = getVisibleServiceForUser(id, user.id);
  if (!service) notFound();

  const plan = db.select().from(plans).where(eq(plans.id, service.planId)).get();
  const region = db.select().from(regions).where(eq(regions.slug, service.regionSlug)).get();
  const os = db.select().from(osImages).where(eq(osImages.slug, service.osSlug)).get();
  const allImages = db.select().from(osImages).where(eq(osImages.isActive, true)).all();
  const allPlans = db.select().from(plans).where(eq(plans.isActive, true)).all();
  const snapshotRows = listSnapshots(service.id);
  const history = serviceActionHistory(service.id);
  const providers = availableProviders();
  const tripayChannels = await listTripayChannels();
  const pendingInvoices = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.serviceId, service.id), eq(invoices.status, "unpaid")))
    .orderBy(desc(invoices.createdAt))
    .all();
  const isProvisioning = service.status === "provisioning";

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "VPS saya", href: "/dashboard/vps" },
          { label: service.hostname },
        ]}
        title={service.hostname}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={service.status} label={serviceStatusLabel[service.status]} />
            <span>
              {plan?.name ?? "Paket"} · {region?.name ?? service.regionSlug} · {os?.name ?? service.osSlug}
            </span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
              <Link href="/dashboard/vps">
                <ArrowLeft className="size-4" /> Kembali
              </Link>
            </Button>
            {verified && ["active", "suspended"].includes(service.status) && plan ? (
              <RenewServiceDialog
                serviceId={service.id}
                hostname={service.hostname}
                prices={{
                  weekly: cycleUnitPrice(plan, "weekly"),
                  monthly: cycleUnitPrice(plan, "monthly"),
                  quarterly: cycleUnitPrice(plan, "quarterly"),
                  yearly: cycleUnitPrice(plan, "yearly"),
                }}
                defaultCycle={service.billingCycle}
                providers={providers}
                tripayChannels={tripayChannels}
                balance={user.balance}
              />
            ) : null}
          </>
        }
      />

      {!verified ? (
        <VerificationRequired
          title="Verifikasi akun untuk perpanjangan dan upgrade"
          description="Kamu tetap bisa mengelola VPS yang sudah aktif. Verifikasi akun via kode WhatsApp atau email untuk memperpanjang, upgrade, atau membayar invoice."
        />
      ) : null}

      {isProvisioning ? <ProvisioningProgress serviceId={service.id} /> : null}

      {pendingInvoices.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#E3E8E4] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#92400E]">
              <Receipt className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#101613]">
                {pendingInvoices.length} invoice menunggu pembayaran
              </p>
              <p className="text-xs text-[#5B6B60]">
                Total {formatIDR(pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0))} · jatuh tempo{" "}
                {formatDateTime(pendingInvoices[0]?.dueDate)}
              </p>
            </div>
          </div>
          <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Link href={`/dashboard/invoices/${pendingInvoices[0].id}`}>Bayar sekarang</Link>
          </Button>
        </div>
      ) : null}

      {service.billingCycle === "weekly" && ["active", "suspended"].includes(service.status) ? (
        <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
          <p className="font-bold">VPS mingguan · dihapus otomatis</p>
          <p className="mt-1 leading-relaxed">
            Masa aktif berakhir <strong>{formatDateTime(service.periodEnd)}</strong>. Droplet akan dihapus
            otomatis saat masa aktif selesai. Kamu akan menerima pengingat H-1; perpanjang sebelum batas waktu
            jika masih membutuhkan server.
          </p>
        </div>
      ) : null}

      <div className="flex gap-1 overflow-x-auto border-b border-[#E3E8E4] pb-px">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={`/dashboard/vps/${service.id}?tab=${item.key}`}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              tab === item.key
                ? "border-[#0B3D2E] text-[#0B3D2E]"
                : "border-transparent text-[#5B6B60] hover:text-[#0B3D2E]",
            )}
            aria-current={tab === item.key ? "page" : undefined}
          >
            <item.icon className="size-4" /> {item.label}
          </Link>
        ))}
      </div>

      {tab === "ringkasan" ? (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <SectionCard title="Spesifikasi & jaringan">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Network, label: "IPv4", value: service.ipv4 ?? "Menyusul" },
                  { icon: Network, label: "IPv6", value: service.ipv6 ?? "Belum aktif" },
                  { icon: Globe2, label: "Region", value: region?.name ?? service.regionSlug },
                  { icon: Cpu, label: "vCPU", value: `${plan?.vcpus ?? "—"} vCPU` },
                  { icon: Database, label: "RAM", value: plan ? `${plan.ramMb / 1024} GB` : "—" },
                  { icon: HardDrive, label: "Disk", value: plan ? `${plan.diskGb} GB SSD` : "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-3.5">
                    <p className="flex items-center gap-1.5 text-xs text-[#8A9A90]">
                      <item.icon className="size-3.5" /> {item.label}
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold break-all text-[#101613]">{item.value}</p>
                  </div>
                ))}
              </div>
              <dl className="mt-4 divide-y divide-[#EDF1EE]">
                <InfoRow label="Sistem operasi" value={os?.name ?? service.osSlug} />
                <InfoRow label="Hostname" value={<span className="font-mono">{service.hostname}</span>} />
                <InfoRow label="Dibuat" value={formatDateTime(service.createdAt)} />
                <InfoRow label="Masa aktif" value={`${formatDate(service.periodStart)} — ${formatDate(service.periodEnd)}`} />
              </dl>
            </SectionCard>

            <SectionCard title="Aksi cepat" description="Operasi umum tanpa meninggalkan halaman ini.">
              <div className="flex flex-wrap gap-2">
                <QuickPowerActions service={service} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#EDF1EE] pt-4">
                <ResetPasswordButton serviceId={service.id} />
                <SnapshotDialog serviceId={service.id} />
                <RenameDialog service={service} />
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="Langganan">
              <dl className="divide-y divide-[#EDF1EE]">
                <InfoRow label="Paket" value={plan?.name ?? "—"} />
                <InfoRow label="Siklus" value={cycleLabel[service.billingCycle]} />
                <InfoRow
                  label={`Harga ${cyclePriceUnit[service.billingCycle]}`}
                  value={plan ? formatIDR(cycleUnitPrice(plan, service.billingCycle)) : "—"}
                />
                <InfoRow
                  label="Perpanjangan berikutnya"
                  value={formatDate(service.periodEnd)}
                  hint={
                    service.billingCycle === "weekly"
                      ? "Mingguan · dihapus otomatis"
                      : `${cycleLabel[service.billingCycle]} · ${service.autoRenew ? "otomatis" : "manual"}`
                  }
                />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {service.billingCycle !== "weekly" ? (
                  <AutoRenewToggle serviceId={service.id} enabled={service.autoRenew} />
                ) : null}
                {verified && service.status === "active" ? (
                  <UpgradeServiceDialog
                    serviceId={service.id}
                    currentPlanId={service.planId}
                    plans={allPlans.map((item) => ({
                      id: item.id,
                      name: item.name,
                      priceMonthly: item.priceMonthly,
                    }))}
                    balance={user.balance}
                  />
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Butuh bantuan?">
              <p className="text-sm leading-relaxed text-[#5B6B60]">
                Tim support siap membantu 24/7. Sertakan hostname dan waktu kejadian agar penanganan
                lebih cepat.
              </p>
              <Button asChild className="mt-4 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                <Link href={`/dashboard/tiket/baru?layanan=${service.id}`}>Buka tiket support</Link>
              </Button>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {tab === "akses" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Kredensial root" description="Gunakan SSH untuk akses aman.">
            <div className="space-y-4">
              <div className="rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-4">
                <p className="text-xs text-[#8A9A90]">Username</p>
                <p className="mt-1 font-mono text-sm font-bold text-[#101613]">root</p>
              </div>
              <RevealPassword serviceId={service.id} hasPassword={Boolean(service.rootPasswordEncrypted)} />
              <div className="rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-4">
                <p className="text-xs text-[#8A9A90]">Perintah SSH</p>
                <code className="mt-1 block font-mono text-sm break-all text-[#101613]">
                  ssh root@{service.ipv4 ?? "IP_VPS"}
                </code>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="SSH key" description="Key yang terpasang saat provisioning.">
            {service.sshKeyId ? (
              <p className="text-sm text-[#5B6B60]">
                VPS ini dibuat menggunakan SSH key pilihanmu. Password root tetap tersedia sebagai
                cadangan.
              </p>
            ) : (
              <p className="text-sm text-[#5B6B60]">
                VPS ini menggunakan password root. Kamu bisa menambahkan SSH key ke akun untuk
                pemesanan berikutnya.
              </p>
            )}
            <Button asChild variant="outline" className="mt-4 border-[#D8E2DB] bg-white">
              <Link href="/dashboard/ssh-keys">
                <KeyRound className="size-4" /> Kelola SSH keys
              </Link>
            </Button>
            <div className="mt-4 rounded-xl bg-[#F3F9F5] p-4 text-xs leading-relaxed text-[#5B6B60]">
              <p className="font-semibold text-[#0B3D2E]">Tips keamanan</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Ganti password root setelah login pertama.</li>
                <li>Gunakan SSH key dan nonaktifkan login password bila memungkinkan.</li>
                <li>Aktifkan firewall dan hanya buka port yang diperlukan.</li>
              </ul>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {tab === "aksi" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Daya & sinkronisasi" description="Kontrol status server.">
            <div className="flex flex-wrap gap-2">
              <QuickPowerActions service={service} />
            </div>
          </SectionCard>
          <SectionCard title="Sistem" description="Operasi yang memengaruhi sistem operasi.">
            <div className="flex flex-wrap gap-2">
              <ResetPasswordButton serviceId={service.id} />
              <RebuildDialog
                service={service}
                images={allImages.map((image) => ({ slug: image.slug, name: image.name }))}
              />
              {["enable_ipv6", "enable_backups", "disable_backups"].map((action) => (
                <ActionButtonRow key={action} serviceId={service.id} action={action} />
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Manajemen" description="Ganti nama atau hapus server secara permanen.">
            <div className="flex flex-wrap gap-2">
              <RenameDialog service={service} />
              <Link
                href={`/dashboard/tiket/baru?layanan=${service.id}&topik=terminasi`}
                className="inline-flex items-center gap-2 rounded-md border border-[#FECACA] px-3 py-2 text-sm font-medium text-[#B91C1C] hover:bg-[#FEE2E2]"
              >
                Ajukan terminasi
              </Link>
            </div>
            <p className="mt-3 text-xs text-[#8A9A90]">
              Terminasi permanen dilakukan oleh admin melalui tiket agar data bisa dipastikan aman.
            </p>
          </SectionCard>
          <SectionCard title="Status layanan" description="Pantau status terakhir.">
            <dl className="divide-y divide-[#EDF1EE]">
              <InfoRow label="Status" value={<StatusBadge status={service.status} label={serviceStatusLabel[service.status]} />} />
              <InfoRow label="Droplet ID" value={<span className="font-mono text-xs">{service.doDropletId ?? "—"}</span>} />
              <InfoRow label="Size" value={<span className="font-mono">{service.sizeSlug}</span>} />
              <InfoRow label="Terakhir disinkronkan" value={formatRelative(service.periodEnd)} />
            </dl>
          </SectionCard>
        </div>
      ) : null}

      {tab === "snapshot" ? (
        <SectionCard
          title="Snapshot"
          description="Cadangan kondisi disk pada waktu tertentu."
          action={<SnapshotDialog serviceId={service.id} />}
          bodyClassName="p-0"
        >
          {snapshotRows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Box className="mx-auto size-8 text-[#8A9A90]" />
              <p className="mt-3 text-sm font-semibold text-[#101613]">Belum ada snapshot</p>
              <p className="mt-1 text-sm text-[#5B6B60]">Buat snapshot sebelum perubahan besar pada server.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold text-[#5B6B60] uppercase">
                    <th className="px-4 py-2.5">Nama</th>
                    <th className="px-4 py-2.5">Dibuat</th>
                    <th className="px-4 py-2.5">ID</th>
                    <th className="px-4 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotRows.map((snapshot) => (
                    <tr key={snapshot.id} className="border-b border-[#EDF1EE] last:border-0">
                      <td className="px-4 py-3 font-semibold text-[#101613]">{snapshot.name}</td>
                      <td className="px-4 py-3 text-[#5B6B60]">{formatDateTime(snapshot.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#8A9A90]">{snapshot.doSnapshotId}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteSnapshotButton serviceId={service.id} snapshot={snapshot} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}

      {tab === "riwayat" ? (
        <SectionCard title="Riwayat aksi" description="Semua operasi yang dijalankan pada VPS ini." bodyClassName="p-0">
          {history.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[#5B6B60]">Belum ada riwayat aksi.</p>
          ) : (
            <ol className="divide-y divide-[#EDF1EE]">
              {history.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span
                    className={cn(
                      "mt-1 size-2 shrink-0 rounded-full",
                      item.resultStatus === "success" ? "bg-[#16A34A]" : "bg-[#DC2626]",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#101613]">
                      {item.action.replaceAll("_", " ")}
                      <span className="ml-2 text-xs font-normal text-[#8A9A90]">
                        oleh {item.actor}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-[#5B6B60]">{item.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-[#8A9A90]">{formatRelative(item.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}

function ActionButtonRow({ serviceId, action }: { serviceId: string; action: string }) {
  const labels: Record<string, string> = {
    enable_ipv6: "Aktifkan IPv6",
    enable_backups: "Aktifkan backup",
    disable_backups: "Matikan backup",
  };
  return (
    <ActionForm action={serviceActionAction} className="inline-flex">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="action" value={action} />
      <SubmitButton variant="outline" size="sm" className="border-[#D8E2DB] bg-white" pendingText="Memproses…">
        {labels[action] ?? action}
      </SubmitButton>
    </ActionForm>
  );
}
