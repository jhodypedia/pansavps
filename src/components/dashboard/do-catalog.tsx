"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import type { ActionResult } from "@/server/actions/types";
import {
  recalculatePlanPricesAction,
  setPlanPricingModeAction,
  syncDoCatalogAction,
} from "@/server/actions/admin";
import { ActionButton } from "@/components/dashboard/action-button";
import { SectionCard } from "@/components/dashboard/section-card";
import { formatIDR } from "@/lib/format";

export type DoCatalogRow = {
  size: {
    slug: string;
    memory: number;
    vcpus: number;
    disk: number;
    transfer: number;
    price_monthly: number;
    available: boolean;
  };
  plan: {
    id: number;
    name: string;
    priceMonthly: number;
    pricingMode: "auto" | "custom";
    isActive: boolean;
  } | null;
  suggestedPrice: number;
};

function ramLabel(mb: number): string {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

export function DoCatalog({
  rows,
  error,
  mock,
  usdRate,
  markupPercent,
}: {
  rows: DoCatalogRow[];
  error: string | null;
  mock: boolean;
  usdRate: number;
  markupPercent: number;
}) {
  const autoCount = rows.filter((row) => row.plan?.pricingMode === "auto").length;

  return (
    <SectionCard
      title="Katalog DigitalOcean"
      description={`Produk live dari API DigitalOcean. Harga jual otomatis mengikuti kurs ${formatIDR(usdRate)}/USD dan markup ${markupPercent}%.`}
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF1EE] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B6B60]">
          <span className="rounded-full border border-[#CFE6D8] bg-[#E7F4EC] px-2.5 py-1 font-semibold text-[#0B3D2E]">
            {mock ? "Mode mock" : "Live API"}
          </span>
          <span>
            {rows.length} produk · {autoCount} harga otomatis
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            action={() => syncDoCatalogAction() as Promise<ActionResult>}
            className="border-[#BFE3CC] bg-white text-[#0B3D2E]"
            pendingText="Menarik produk…"
          >
            <RefreshCw className="size-3.5" /> Sinkronkan dari DO
          </ActionButton>
          <ActionButton
            action={() => recalculatePlanPricesAction() as Promise<ActionResult>}
            className="border-[#D8E2DB] bg-white"
            pendingText="Menghitung…"
          >
            <Sparkles className="size-3.5" /> Hitung ulang harga otomatis
          </ActionButton>
        </div>
      </div>

      {error ? (
        <div className="border-b border-[#FECACA] bg-[#FEF2F2] px-5 py-3 text-sm text-[#991B1B]">
          Gagal mengambil katalog DigitalOcean: {error}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-[#5B6B60]">
          Katalog DigitalOcean belum tersedia. Periksa token dan koneksi di Pengaturan.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                <th className="px-4 py-2.5">Produk DO</th>
                <th className="px-4 py-2.5">Spesifikasi</th>
                <th className="px-4 py-2.5">Harga DO</th>
                <th className="px-4 py-2.5">Harga jual</th>
                <th className="px-4 py-2.5">Mode</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ size, plan, suggestedPrice }) => (
                <tr key={size.slug} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#F9FBFA]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#101613]">
                      {plan?.name ?? `VPS ${ramLabel(size.memory)} · ${size.vcpus} vCPU`}
                    </p>
                    <p className="font-mono text-[10px] text-[#8A9A90]">{size.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B60]">
                    {size.vcpus} vCPU · {ramLabel(size.memory)} RAM
                    <br />
                    {size.disk} GB SSD · {size.transfer} TB transfer
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[#5B6B60]">
                    ${size.price_monthly.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {plan ? (
                      <span className="font-semibold text-[#101613]">{formatIDR(plan.priceMonthly)}</span>
                    ) : (
                      <span className="text-xs text-[#8A9A90]">
                        Saran {formatIDR(suggestedPrice)}
                        <br />
                        Belum diimpor
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {plan ? (
                      <span
                        className={
                          plan.pricingMode === "auto"
                            ? "rounded-full bg-[#E7F4EC] px-2 py-1 text-[10px] font-bold text-[#0B3D2E]"
                            : "rounded-full bg-[#F1F3F2] px-2 py-1 text-[10px] font-bold text-[#5B6B60]"
                        }
                      >
                        {plan.pricingMode === "auto" ? "Otomatis" : "Custom"}
                      </span>
                    ) : (
                      <span className="text-xs text-[#8A9A90]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {plan ? (
                      <span className={plan.isActive ? "text-xs font-semibold text-[#15803D]" : "text-xs font-semibold text-[#92400E]"}>
                        {plan.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    ) : (
                      <span className="text-xs text-[#8A9A90]">Baru</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {plan ? (
                      <ActionButton
                        action={() =>
                          setPlanPricingModeAction(plan.id, plan.pricingMode === "auto" ? "custom" : "auto") as Promise<ActionResult>
                        }
                        className="border-[#D8E2DB] bg-white"
                      >
                        {plan.pricingMode === "auto" ? "Jadikan custom" : "Ikuti otomatis"}
                      </ActionButton>
                    ) : (
                      <span className="text-xs text-[#8A9A90]">Klik Sinkronkan</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-[#EDF1EE] px-5 py-3 text-xs leading-relaxed text-[#8A9A90]">
        Sinkronisasi menambahkan produk DO yang belum ada dan memperbarui spesifikasi serta modal. Harga custom tidak ditimpa; harga otomatis dihitung ulang dari pengaturan admin.
      </p>
    </SectionCard>
  );
}
