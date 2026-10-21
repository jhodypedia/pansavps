import { desc } from "drizzle-orm";
import { Tag, TicketPercent } from "lucide-react";
import { db } from "@/lib/db";
import { promoCodes } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime, formatIDR } from "@/lib/format";
import { isPromoExpired } from "@/lib/promo";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { PromoEditor, PromoRowActions } from "@/components/dashboard/promo-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Kode Promo" };

export default async function AdminPromoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const filter = ["all", "active", "inactive", "expired"].includes(status ?? "") ? status! : "all";
  const search = (q ?? "").trim().toLowerCase();

  const all = db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)).all();
  const isExpired = (promo: (typeof all)[number]) => isPromoExpired(promo);
  const rows = all.filter((promo) => {
    if (filter === "active" && (!promo.isActive || isExpired(promo))) return false;
    if (filter === "inactive" && promo.isActive) return false;
    if (filter === "expired" && !isExpired(promo)) return false;
    if (!search) return true;
    return promo.code.toLowerCase().includes(search);
  });

  const totalUsed = all.reduce((sum, promo) => sum + promo.usedCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kode promo"
        description="Buat diskon persen atau nominal dengan batas kuota dan masa berlaku."
        actions={<PromoEditor />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total kode", value: String(all.length), hint: `${all.filter((promo) => promo.isActive).length} aktif` },
          { label: "Total pemakaian", value: String(totalUsed), hint: "Semua kode promo" },
          {
            label: "Sedang berjalan",
            value: String(all.filter((promo) => promo.isActive && !isExpired(promo)).length),
            hint: "Aktif dan belum kedaluwarsa",
          },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
            <p className="text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">{item.label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#101613]">{item.value}</p>
            <p className="mt-0.5 text-xs text-[#8A9A90]">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "Semua" },
            { key: "active", label: "Aktif" },
            { key: "inactive", label: "Nonaktif" },
            { key: "expired", label: "Kedaluwarsa" },
          ].map((item) => (
            <Button
              key={item.key}
              asChild
              variant={filter === item.key ? "default" : "outline"}
              size="sm"
              className={cn(
                filter === item.key
                  ? "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
                  : "border-[#D8E2DB] bg-white text-[#5B6B60]",
              )}
            >
              <a href={item.key === "all" ? "/admin/promo" : `/admin/promo?status=${item.key}`}>{item.label}</a>
            </Button>
          ))}
        </div>
        <form className="flex gap-2" action="/admin/promo">
          {filter !== "all" ? <input type="hidden" name="status" value={filter} /> : null}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari kode promo…"
            className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm sm:w-56"
          />
          <Button type="submit" variant="outline" className="border-[#D8E2DB] bg-white">
            Cari
          </Button>
        </form>
      </div>

      <SectionCard bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={TicketPercent} title="Tidak ada promo" description="Buat kode promo untuk meningkatkan konversi." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <th className="px-4 py-2.5">Kode</th>
                  <th className="px-4 py-2.5">Diskon</th>
                  <th className="px-4 py-2.5">Min. transaksi</th>
                  <th className="px-4 py-2.5">Kuota</th>
                  <th className="px-4 py-2.5">Berlaku</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((promo) => {
                  const percent = promo.quota ? Math.min(100, Math.round((promo.usedCount / promo.quota) * 100)) : null;
                  return (
                    <tr key={promo.id} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#F9FBFA]">
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm font-bold text-[#101613]">{promo.code}</p>
                        <p className="text-xs text-[#8A9A90]">Dibuat {formatDateTime(promo.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[#101613]">
                        <p className="font-semibold">
                          {promo.type === "percent" ? `${promo.value}%` : formatIDR(promo.value)}
                        </p>
                        {promo.maxDiscount ? (
                          <p className="text-xs text-[#8A9A90]">Maks. {formatIDR(promo.maxDiscount)}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[#5B6B60]">{promo.minAmount > 0 ? formatIDR(promo.minAmount) : "—"}</td>
                      <td className="px-4 py-3">
                        <p className="text-[#101613]">
                          {promo.usedCount}
                          {promo.quota ? ` / ${promo.quota}` : " / ∞"}
                        </p>
                        {percent !== null ? (
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-[#EDF1EE]">
                            <div
                              className={cn("h-full rounded-full", percent >= 100 ? "bg-[#DC2626]" : "bg-[#0B3D2E]")}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5B6B60]">
                        {promo.startsAt ? formatDate(promo.startsAt) : "Sekarang"}
                        <br />
                        <span className="text-[#8A9A90]">s/d {promo.endsAt ? formatDate(promo.endsAt) : "tanpa batas"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isExpired(promo) ? (
                          <StatusBadge status="expired" label="Kedaluwarsa" />
                        ) : promo.isActive ? (
                          <StatusBadge status="active" label="Aktif" />
                        ) : (
                          <StatusBadge status="suspended" label="Nonaktif" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <PromoEditor promo={promo} />
                          <PromoRowActions promoId={promo.id} active={promo.isActive} used={promo.usedCount} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="flex items-center gap-1.5 text-xs text-[#8A9A90]">
        <Tag className="size-3.5" /> Promo dengan pemakaian tetap tersimpan sebagai riwayat meskipun dinonaktifkan.
      </p>
    </div>
  );
}
