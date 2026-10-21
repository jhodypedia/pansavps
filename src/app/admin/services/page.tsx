import Link from "next/link";
import { ArrowRight, Server } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, services, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate, serviceStatusLabel } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { DoServiceSync } from "@/components/admin/do-service-sync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Layanan VPS Admin" };

const filters = [
  { key: "all", label: "Semua" },
  { key: "active", label: "Aktif" },
  { key: "provisioning", label: "Menyiapkan" },
  { key: "suspended", label: "Ditangguhkan" },
  { key: "failed", label: "Gagal" },
  { key: "terminated", label: "Dihentikan" },
];

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const filter = filters.some((item) => item.key === status) ? status! : "all";
  const search = (q ?? "").trim().toLowerCase();

  const all = db.select().from(services).orderBy(desc(services.createdAt)).all();
  const userRows = db.select().from(users).all();
  const userMap = new Map(userRows.map((user) => [user.id, user]));
  const planRows = db.select().from(plans).all();
  const planMap = new Map(planRows.map((plan) => [plan.id, plan]));
  const rows = all.filter((service) => {
    if (filter !== "all" && service.status !== filter) return false;
    if (!search) return true;
    const owner = userMap.get(service.userId);
    return [service.hostname, service.ipv4, owner?.name, owner?.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Layanan VPS"
        description="Semua droplet yang dikelola toko, termasuk status dan masa aktif."
      />

      <DoServiceSync />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => {
            const count = item.key === "all" ? all.length : all.filter((service) => service.status === item.key).length;
            return (
              <Link
                key={item.key}
                href={item.key === "all" ? "/admin/services" : `/admin/services?status=${item.key}`}
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
        <form className="flex gap-2" action="/admin/services">
          {filter !== "all" ? <input type="hidden" name="status" value={filter} /> : null}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari hostname, IP, pengguna…"
            className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm sm:w-64"
          />
          <Button type="submit" variant="outline" className="border-[#D8E2DB] bg-white">
            Cari
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Server} title="Tidak ada layanan" description="Layanan VPS yang cocok dengan filter akan muncul di sini." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <th className="px-4 py-2.5">Hostname</th>
                  <th className="px-4 py-2.5">Pengguna</th>
                  <th className="px-4 py-2.5">Paket</th>
                  <th className="px-4 py-2.5">IPv4</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Masa aktif</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((service) => {
                  const owner = userMap.get(service.userId);
                  const plan = planMap.get(service.planId);
                  return (
                    <tr key={service.id} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#FBFCFB]">
                      <td className="px-4 py-3">
                        <Link href={`/admin/services/${service.id}`} className="font-mono text-xs font-semibold text-[#0B3D2E] hover:underline">
                          {service.hostname}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-[#8A9A90]">{service.regionSlug} · {service.sizeSlug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#101613]">{owner?.name ?? "—"}</p>
                        <p className="text-xs text-[#8A9A90]">{owner?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#5B6B60]">{plan?.name ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#5B6B60]">{service.ipv4 ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={service.status} label={serviceStatusLabel[service.status]} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5B6B60]">{formatDate(service.periodEnd)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm" className="text-[#0B3D2E] hover:bg-[#F3F9F5]">
                          <Link href={`/admin/services/${service.id}`}>
                            Kelola <ArrowRight className="size-3.5" />
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
