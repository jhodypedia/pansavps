import Link from "next/link";
import { desc } from "drizzle-orm";
import { ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { db } from "@/lib/db";
import { orders, services, users } from "@/lib/db/schema";
import { isUserVerified, requireAdmin } from "@/lib/auth";
import { formatDateTime, formatIDR, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pengguna" };

const filters = [
  { key: "all", label: "Semua" },
  { key: "active", label: "Aktif" },
  { key: "suspended", label: "Ditangguhkan" },
  { key: "unverified", label: "Belum verifikasi" },
  { key: "admin", label: "Admin" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const filter = filters.some((item) => item.key === status) ? status! : "all";
  const search = (q ?? "").trim().toLowerCase();

  const all = db.select().from(users).orderBy(desc(users.createdAt)).all();
  const serviceRows = db.select().from(services).all();
  const orderRows = db.select().from(orders).all();

  const serviceCount = new Map<string, number>();
  for (const service of serviceRows) {
    if (service.status === "terminated") continue;
    serviceCount.set(service.userId, (serviceCount.get(service.userId) ?? 0) + 1);
  }
  const orderCount = new Map<string, number>();
  for (const order of orderRows) {
    orderCount.set(order.userId, (orderCount.get(order.userId) ?? 0) + 1);
  }

  const rows = all.filter((user) => {
    if (filter === "admin" && user.role !== "admin") return false;
    if (filter === "unverified" && isUserVerified(user)) return false;
    if (filter === "active" && user.status !== "active") return false;
    if (filter === "suspended" && user.status !== "suspended") return false;
    if (!search) return true;
    return [user.name, user.email, user.phone, user.id]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  const totalBalance = all.reduce((sum, user) => sum + user.balance, 0);
  const verified = all.filter((user) => isUserVerified(user)).length;
  const suspended = all.filter((user) => user.status === "suspended").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengguna"
        description="Kelola akun pelanggan, role admin, dan saldo."
        actions={<ExportCsvButton type="users" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total pengguna", value: String(all.length), hint: `${verified} terverifikasi`, icon: Users },
          { label: "Admin", value: String(all.filter((user) => user.role === "admin").length), hint: "Akses penuh panel", icon: ShieldCheck },
          { label: "Ditangguhkan", value: String(suspended), hint: "Tidak dapat masuk", icon: UserX },
          { label: "Total saldo", value: formatIDR(totalBalance), hint: "Saldo seluruh pengguna", icon: UserCheck },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">{item.label}</p>
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                <item.icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-[#101613]">{item.value}</p>
            <p className="mt-0.5 text-xs text-[#8A9A90]">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => {
            const count =
              item.key === "all"
                ? all.length
                : item.key === "admin"
                  ? all.filter((user) => user.role === "admin").length
                  : item.key === "unverified"
                    ? all.filter((user) => !isUserVerified(user)).length
                    : all.filter((user) => user.status === item.key).length;
            return (
              <Link
                key={item.key}
                href={item.key === "all" ? "/admin/users" : `/admin/users?status=${item.key}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
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
        <form className="flex gap-2" action="/admin/users">
          {filter !== "all" ? <input type="hidden" name="status" value={filter} /> : null}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari nama, email, nomor…"
            className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm sm:w-64"
          />
          <Button type="submit" variant="outline" className="border-[#D8E2DB] bg-white">
            Cari
          </Button>
        </form>
      </div>

      <SectionCard bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title="Tidak ada pengguna"
              description="Ubah filter atau kata kunci pencarian untuk melihat pengguna lain."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <th className="px-4 py-2.5">Pengguna</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Saldo</th>
                  <th className="px-4 py-2.5">Layanan</th>
                  <th className="px-4 py-2.5">Terakhir masuk</th>
                  <th className="px-4 py-2.5">Terdaftar</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#F9FBFA]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${user.id}`} className="font-semibold text-[#101613] hover:text-[#0B3D2E] hover:underline">
                        {user.name}
                      </Link>
                      <p className="text-xs text-[#8A9A90]">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status={user.status} label={user.status === "active" ? "Aktif" : "Ditangguhkan"} />
                        {user.role === "admin" ? <StatusBadge status="admin" label="Admin" tone="info" /> : null}
                        {!isUserVerified(user) ? <StatusBadge status="unverified" label="Belum verifikasi" tone="warning" /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap text-[#101613]">{formatIDR(user.balance)}</td>
                    <td className="px-4 py-3 text-[#5B6B60]">
                      {serviceCount.get(user.id) ?? 0}
                      <span className="text-xs text-[#8A9A90]"> VPS · {orderCount.get(user.id) ?? 0} pesanan</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8A9A90]">{formatRelative(user.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-xs text-[#8A9A90]">{formatDateTime(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="outline" size="sm" className="border-[#D8E2DB] bg-white">
                        <Link href={`/admin/users/${user.id}`}>Detail</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-[#EDF1EE] px-4 py-3 text-xs text-[#8A9A90]">
          Menampilkan {rows.length} dari {all.length} pengguna.
        </div>
      </SectionCard>
    </div>
  );
}
