import Link from "next/link";
import { Cpu, Globe2, HardDrive, Network, Plus, Server, ShieldCheck, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { plans, regions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { listVisibleUserServices } from "@/server/services/services";
import {
  cycleLabel,
  cyclePriceUnit,
  formatDate,
  formatIDR,
  serviceStatusLabel,
} from "@/lib/format";
import { cycleUnitPrice } from "@/lib/pricing";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "VPS Saya" };

const filters = [
  { key: "all", label: "Semua" },
  { key: "active", label: "Aktif" },
  { key: "provisioning", label: "Menyiapkan" },
  { key: "suspended", label: "Ditangguhkan" },
  { key: "terminated", label: "Dihentikan" },
];

export default async function VpsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = filters.some((item) => item.key === params.status) ? params.status! : "all";

  const all = listVisibleUserServices(user.id);
  const planRows = db.select().from(plans).all();
  const planMap = new Map(planRows.map((plan) => [plan.id, plan]));
  const regionRows = db.select().from(regions).all();
  const regionMap = new Map(regionRows.map((region) => [region.slug, region]));
  const rows = filter === "all" ? all : all.filter((service) => service.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="VPS saya"
        description="Atur semua server di sini: nyalakan, reboot, ganti password, pasang ulang OS, sampai buat snapshot."
        actions={
          <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Link href="/dashboard/pesanan/baru">
              <Plus className="size-4" /> Pesan VPS
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter status VPS">
        {filters.map((item) => {
          const count =
            item.key === "all"
              ? all.length
              : all.filter((service) => service.status === item.key).length;
          return (
            <Link
              key={item.key}
              href={item.key === "all" ? "/dashboard/vps" : `/dashboard/vps?status=${item.key}`}
              role="tab"
              aria-selected={filter === item.key}
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
          icon={Server}
          title={filter === "all" ? "Belum ada VPS" : "Tidak ada VPS dengan status ini"}
          description="Pesan VPS baru, lalu bayar. Setelah pembayaran masuk, server langsung dibuat dan data aksesnya dikirim ke email serta WhatsApp."
          action={
            <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href="/dashboard/pesanan/baru">
                <Plus className="size-4" /> Pesan VPS sekarang
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((service) => {
            const plan = planMap.get(service.planId);
            const region = regionMap.get(service.regionSlug);
            return (
              <article
                key={service.id}
                className="flex flex-col rounded-2xl border border-[#E3E8E4] bg-white p-5 transition-shadow hover:shadow-[0_12px_28px_-18px_rgba(11,61,46,0.35)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold text-[#101613]">
                      {service.hostname}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8A9A90]">
                      {plan?.name ?? "Paket"} · {cycleLabel[service.billingCycle]}
                    </p>
                  </div>
                  <StatusBadge
                    status={service.status}
                    label={serviceStatusLabel[service.status]}
                  />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#F7F8F7] p-3 text-xs">
                  <div>
                    <dt className="text-[#8A9A90]">IP address</dt>
                    <dd className="mt-0.5 flex items-center gap-1 font-mono font-semibold text-[#101613]">
                      <Network className="size-3 text-[#0B3D2E]" />
                      {service.ipv4 ?? "menyusul"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#8A9A90]">Region</dt>
                    <dd className="mt-0.5 flex items-center gap-1 font-semibold text-[#101613]">
                      <Globe2 className="size-3 text-[#0B3D2E]" />
                      {region?.name ?? service.regionSlug}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#8A9A90]">Spesifikasi</dt>
                    <dd className="mt-0.5 flex items-center gap-1 font-semibold text-[#101613]">
                      <Cpu className="size-3 text-[#0B3D2E]" />
                      {plan?.vcpus ?? "—"} vCPU · {plan ? plan.ramMb / 1024 : "—"} GB
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#8A9A90]">Disk</dt>
                    <dd className="mt-0.5 flex items-center gap-1 font-semibold text-[#101613]">
                      <HardDrive className="size-3 text-[#0B3D2E]" />
                      {plan?.diskGb ?? "—"} GB SSD
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between text-xs text-[#5B6B60]">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-[#0B3D2E]" />
                    {service.billingCycle === "weekly"
                      ? service.status === "terminated"
                        ? "Dihapus otomatis"
                        : "Dihapus otomatis saat berakhir"
                      : service.autoRenew
                        ? "Perpanjangan otomatis aktif"
                        : "Perpanjangan otomatis nonaktif"}
                  </span>
                  <span>
                    s/d <strong className="text-[#101613]">{formatDate(service.periodEnd)}</strong>
                  </span>
                </div>

                {plan ? (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[#8A9A90]">
                    <Wallet className="size-3.5" />
                    {service.billingCycle === "weekly" ? "Harga mingguan" : "Perpanjangan"}{" "}
                    {formatIDR(cycleUnitPrice(plan, service.billingCycle))}/{cyclePriceUnit[service.billingCycle]}
                  </div>
                ) : null}

                <div className="mt-4 flex gap-2 border-t border-[#EDF1EE] pt-4">
                  <Button asChild size="sm" className="flex-1 bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                    <Link href={`/dashboard/vps/${service.id}`}>Kelola</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="border-[#D8E2DB] bg-white">
                    <Link href={`/dashboard/vps/${service.id}?tab=akses`}>Akses</Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
