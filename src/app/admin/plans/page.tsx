import { desc } from "drizzle-orm";
import { Package, Pencil, Tags } from "lucide-react";
import { db } from "@/lib/db";
import { planPriceHistory, plans, regions, services, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDateTime, formatIDR } from "@/lib/format";
import { marginInfo } from "@/lib/pricing";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { PlanEditor, PlanRowActions } from "@/components/dashboard/plan-editor";
import { DoCatalog } from "@/components/dashboard/do-catalog";
import { loadDoCatalog } from "@/server/services/do-catalog";

export const metadata = { title: "Paket VPS" };

const fieldLabels: Record<string, string> = {
  priceMonthly: "Harga bulanan",
  priceQuarterly: "Harga 3 bulan",
  priceYearly: "Harga tahunan",
  promoPriceMonthly: "Harga promo",
  setupFee: "Biaya setup",
  costMonthlyUsd: "Modal USD",
};

export default async function AdminPlansPage() {
  await requireAdmin();
  const settings = getSettings();
  const usdRate = Number(settings.usd_idr_rate || 16500);
  const markupPercent = Number(settings.default_markup_percent || 30);

  const allPlans = db.select().from(plans).orderBy(plans.sortOrder, plans.id).all();
  const regionRows = db.select().from(regions).all();
  const activeRegions = regionRows.filter((region) => region.isActive);
  const serviceRows = db.select().from(services).all();
  const usedPlanIds = new Set(serviceRows.map((service) => service.planId));

  const history = db
    .select()
    .from(planPriceHistory)
    .orderBy(desc(planPriceHistory.createdAt))
    .limit(12)
    .all();
  const planMap = new Map(allPlans.map((plan) => [plan.id, plan]));
  const userRows = db.select().from(users).all();
  const userMap = new Map(userRows.map((user) => [user.id, user]));

  const doCatalog = await loadDoCatalog();
  const doRows = doCatalog.items.map(({ size, plan, suggestedPrice }) => ({
    size: {
      slug: size.slug,
      memory: size.memory,
      vcpus: size.vcpus,
      disk: size.disk,
      transfer: size.transfer,
      price_monthly: size.price_monthly,
      available: size.available,
    },
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          pricingMode: plan.pricingMode,
          isActive: plan.isActive,
        }
      : null,
    suggestedPrice,
  }));

  const active = allPlans.filter((plan) => plan.isActive);
  const margins = active.map((plan) =>
    marginInfo({ priceMonthly: plan.priceMonthly, costMonthlyUsd: plan.costMonthlyUsd, usdIdrRate: usdRate }),
  );
  const avgMargin =
    margins.length > 0 ? Math.round(margins.reduce((sum, item) => sum + item.percent, 0) / margins.length) : 0;
  const belowCost = margins.filter((item) => item.belowCost).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paket VPS"
        description="Atur spesifikasi, harga, dan region tiap paket. Semua harga berasal dari database."
        actions={<PlanEditor regions={activeRegions.map((region) => ({ slug: region.slug, name: region.name }))} usdRate={usdRate} markupPercent={markupPercent} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total paket", value: String(allPlans.length), hint: `${active.length} aktif` },
          { label: "Rata-rata margin", value: `${avgMargin}%`, hint: `Markup default ${markupPercent}%` },
          { label: "Di bawah modal", value: String(belowCost), hint: "Perlu penyesuaian harga" },
          { label: "Kurs USD/IDR", value: formatIDR(usdRate), hint: "Dipakai untuk hitung modal" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
            <p className="text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">{item.label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#101613]">{item.value}</p>
            <p className="mt-0.5 text-xs text-[#8A9A90]">{item.hint}</p>
          </div>
        ))}
      </div>

      <DoCatalog
        rows={doRows}
        error={doCatalog.error}
        mock={doCatalog.mock}
        usdRate={usdRate}
        markupPercent={markupPercent}
      />

      <SectionCard bodyClassName="p-0">
        {allPlans.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Package}
              title="Belum ada paket"
              description="Buat paket pertama agar pelanggan dapat memesan VPS."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-sm">
              <thead>
                <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <th className="px-4 py-2.5">Paket</th>
                  <th className="px-4 py-2.5">Spesifikasi</th>
                  <th className="px-4 py-2.5">Modal</th>
                  <th className="px-4 py-2.5">Harga / bulan</th>
                  <th className="px-4 py-2.5">Margin</th>
                  <th className="px-4 py-2.5">Region</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {allPlans.map((plan) => {
                  const margin = marginInfo({
                    priceMonthly: plan.priceMonthly,
                    costMonthlyUsd: plan.costMonthlyUsd,
                    usdIdrRate: usdRate,
                  });
                  return (
                    <tr key={plan.id} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#F9FBFA]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#101613]">{plan.name}</span>
                          {plan.isFeatured ? <StatusBadge status="featured" label="Unggulan" tone="info" dot={false} /> : null}
                        </div>
                        <p className="font-mono text-[10px] text-[#8A9A90]">{plan.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5B6B60]">
                        {plan.vcpus} vCPU · {plan.ramMb >= 1024 ? `${plan.ramMb / 1024} GB` : `${plan.ramMb} MB`} RAM
                        <br />
                        {plan.diskGb} GB SSD · {plan.transferTb} TB transfer
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[#5B6B60]">
                        <p>{formatIDR(margin.modal)}</p>
                        <p className="text-xs text-[#8A9A90]">${plan.costMonthlyUsd.toFixed(2)}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-[#101613]">{formatIDR(plan.priceMonthly)}</p>
                        <p className="text-xs text-[#8A9A90]">
                          {plan.pricingMode === "auto" ? "Otomatis" : "Custom"}
                        </p>
                        {plan.promoPriceMonthly ? (
                          <p className="text-xs text-[#0B3D2E]">Promo {formatIDR(plan.promoPriceMonthly)}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className={margin.belowCost ? "font-semibold text-[#991B1B]" : margin.low ? "font-semibold text-[#92400E]" : "font-semibold text-[#0B3D2E]"}>
                          {formatIDR(margin.margin)}
                        </p>
                        <p className="text-xs text-[#8A9A90]">{Math.round(margin.percent)}%</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {plan.allowRegionSlugs.map((slug) => (
                            <span key={slug} className="rounded-md bg-[#F1F3F2] px-1.5 py-0.5 font-mono text-[10px] text-[#5B6B60]">
                              {slug}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={plan.isActive ? "active" : "suspended"} label={plan.isActive ? "Aktif" : "Nonaktif"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <PlanEditor
                            plan={plan}
                            regions={activeRegions.map((region) => ({ slug: region.slug, name: region.name }))}
                            usdRate={usdRate}
                            markupPercent={markupPercent}
                          />
                          <PlanRowActions planId={plan.id} active={plan.isActive} used={usedPlanIds.has(plan.id)} />
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

      <SectionCard title="Riwayat perubahan harga" description="12 perubahan terakhir, tercatat otomatis." bodyClassName="p-0">
        {history.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Tags} title="Belum ada riwayat" description="Perubahan harga paket akan muncul di sini." />
          </div>
        ) : (
          <ul className="divide-y divide-[#EDF1EE]">
            {history.map((entry) => {
              const plan = planMap.get(entry.planId);
              const actor = entry.changedBy ? userMap.get(entry.changedBy) : null;
              return (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#101613]">
                      {plan?.name ?? `Paket #${entry.planId}`} · {fieldLabels[entry.field] ?? entry.field}
                    </p>
                    <p className="text-xs text-[#8A9A90]">
                      {entry.oldValue || "—"} → {entry.newValue || "—"} · {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-[#5B6B60]">{actor?.name ?? "Sistem"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <p className="flex items-center gap-1.5 text-xs text-[#8A9A90]">
        <Pencil className="size-3.5" /> Harga di bawah modal memerlukan konfirmasi eksplisit sebelum disimpan.
      </p>
    </div>
  );
}
