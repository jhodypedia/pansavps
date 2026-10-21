"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Cpu,
  Database,
  Globe2,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/shared/reveal";
import type { BillingCycle } from "@/lib/db/schema";
import { cycleDiscountPercent, cycleUnitPrice, type Plan } from "@/lib/pricing";
import { cycleLabel, formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Cycle = BillingCycle;
const cycles: Cycle[] = ["weekly", "monthly", "quarterly", "yearly"];

function planDescription(plan: Plan) {
  const base = plan.description?.trim();
  const extra =
    "Termasuk akses root penuh, IPv4 + IPv6, panel kontrol, snapshot, dan aktivasi otomatis setelah pembayaran terverifikasi.";
  return base ? `${base} ${extra}` : extra;
}

function planUseCase(plan: Plan) {
  const ram = plan.ramMb / 1024;
  if (ram <= 0.5) return "Cocok untuk bot, website ringan, dan environment pengembangan.";
  if (ram <= 1) return "Cocok untuk website, API kecil, dan staging.";
  if (ram <= 2) return "Cocok untuk aplikasi produksi kecil dan layanan internal.";
  if (ram <= 4) return "Cocok untuk aplikasi dengan trafik stabil dan beberapa service sekaligus.";
  if (ram <= 8) return "Cocok untuk database, API, dan beban kerja intensif.";
  return "Cocok untuk tim, API besar, dan layanan multi-tenant.";
}

const includedFeatures = [
  "Akses root penuh",
  "IPv4 + IPv6",
  "Panel kontrol",
  "Snapshot",
  "Aktivasi otomatis",
  "Support WhatsApp",
];

export function PricingTable({ items }: { items: Plan[] }) {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div className="space-y-10">
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex rounded-2xl border border-[#D8E2DB] bg-[#F7F8F7] p-1">
          {cycles.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCycle(item)}
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                cycle === item
                  ? "bg-[#0B3D2E] text-white shadow-sm"
                  : "text-[#5B6B60] hover:text-[#101613]",
              )}
            >
              {cycleLabel[item]}
              {item === "yearly" ? (
                <span className="ml-1.5 rounded-full bg-[#16A34A]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#15803D]">
                  Hemat
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="max-w-2xl text-center text-xs leading-relaxed text-[#5B6B60]">
          {cycle === "weekly"
            ? "VPS mingguan aktif 7 hari. Pengingat H-1 dikirim via notifikasi, email, dan WhatsApp."
            : cycle === "monthly"
              ? "Fleksibel untuk mulai cepat. Bayar per bulan tanpa komitmen panjang."
              : cycle === "quarterly"
                ? "Lebih hemat untuk penggunaan 3 bulan ke depan."
                : "Pilihan paling efisien untuk penggunaan jangka panjang."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {items.map((plan, index) => {
          const price = cycleUnitPrice(plan, cycle);
          const discount = cycleDiscountPercent(plan, cycle);
          const monthlyEquivalent =
            cycle === "weekly"
              ? Math.round(price * (30 / 7))
              : cycle === "monthly"
                ? price
                : Math.round(price / (cycle === "quarterly" ? 3 : 12));

          return (
            <Reveal key={plan.id} delay={index * 0.03} className="h-full">
              <article
                className={cn(
                  "group relative flex h-full flex-col rounded-3xl border p-6 transition-all duration-300",
                  plan.isFeatured
                    ? "border-[#0B3D2E] bg-white shadow-[0_24px_70px_-34px_rgba(11,61,46,0.7)] ring-1 ring-[#0B3D2E]/10"
                    : "border-[#E3E8E4] bg-white hover:-translate-y-1 hover:border-[#A9C8B3] hover:shadow-[0_20px_55px_-34px_rgba(11,61,46,0.45)]",
                )}
              >
                {plan.isFeatured ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-[#0B3D2E] px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
                    Paling populer
                  </span>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-bold text-[#101613]">{plan.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">{planDescription(plan)}</p>
                    <p className="mt-3 text-xs font-semibold text-[#0B3D2E]">{planUseCase(plan)}</p>
                  </div>
                  {plan.isFeatured ? (
                    <Badge className="shrink-0 border border-[#CFE6D8] bg-[#E7F4EC] text-[#0B3D2E] hover:bg-[#E7F4EC]">
                      Rekomendasi
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-6 rounded-2xl bg-[#F7F8F7] p-5">
                  <div className="flex items-end gap-2">
                    <span className="font-display text-4xl font-bold tracking-tight text-[#101613]">
                      {formatIDR(price)}
                    </span>
                    <span className="pb-1 text-sm font-medium text-[#5B6B60]">
                      /{cycle === "weekly" ? "minggu" : cycle === "monthly" ? "bulan" : cycle === "quarterly" ? "3 bulan" : "tahun"}
                    </span>
                  </div>
                  {cycle !== "monthly" ? (
                    <p className="mt-1 text-xs text-[#5B6B60]">
                      Setara {formatIDR(monthlyEquivalent)}/bulan
                      {discount > 0 ? (
                        <span className="ml-1.5 font-semibold text-[#15803D]">· hemat {discount}%</span>
                      ) : cycle === "weekly" ? (
                        <span className="ml-1.5 font-semibold text-[#92400E]">· aktif 7 hari</span>
                      ) : null}
                    </p>
                  ) : (plan.promoPriceMonthly ?? 0) > 0 ? (
                    <p className="mt-1 text-xs text-[#5B6B60]">
                      Harga normal <span className="line-through">{formatIDR(plan.priceMonthly)}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[#8A9A90]">Tanpa biaya setup tambahan.</p>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    { icon: Cpu, label: "vCPU", value: plan.vcpus },
                    { icon: Database, label: "RAM", value: `${plan.ramMb / 1024} GB` },
                    { icon: HardDrive, label: "SSD", value: `${plan.diskGb} GB` },
                    { icon: Globe2, label: "Transfer", value: `${plan.transferTb} TB` },
                  ].map((spec) => (
                    <div key={spec.label} className="flex items-center gap-2 rounded-xl border border-[#EDF1EE] bg-white px-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#E7F4EC] text-[#0B3D2E]">
                        <spec.icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold tracking-wide text-[#8A9A90] uppercase">
                          {spec.label}
                        </span>
                        <span className="block text-sm font-bold text-[#101613]">{spec.value}</span>
                      </span>
                    </div>
                  ))}
                </div>

                <ul className="mt-5 flex flex-col gap-2.5 text-sm text-[#5B6B60]">
                  {includedFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E7F4EC] text-[#16A34A]">
                        <Check className="size-3" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6">
                  <Button asChild className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                    <Link href={`/register?plan=${plan.slug}`}>
                      Pesan sekarang <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#E3E8E4] bg-white p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#101613]">Bandingkan semua paket</h2>
            <p className="mt-1 text-sm text-[#5B6B60]">
              Lihat spesifikasi dan harga tiap siklus dalam satu tabel.
            </p>
          </div>
          <Badge className="w-fit border border-[#CFE6D8] bg-[#E7F4EC] text-[#0B3D2E] hover:bg-[#E7F4EC]">
            {items.length} paket aktif
          </Badge>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                <th className="px-5 py-3">Paket</th>
                <th className="px-5 py-3">vCPU</th>
                <th className="px-5 py-3">RAM</th>
                <th className="px-5 py-3">SSD</th>
                <th className="px-5 py-3">Transfer</th>
                <th className="px-5 py-3">Mingguan</th>
                <th className="px-5 py-3">Bulanan</th>
                <th className="px-5 py-3">Tahunan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((plan) => (
                <tr key={plan.id} className="border-b border-[#EDF1EE] transition-colors last:border-0 hover:bg-[#FBFCFB]">
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-[#101613]">{plan.name}</span>
                    {plan.isFeatured ? (
                      <span className="ml-2 rounded-full bg-[#E7F4EC] px-2 py-0.5 text-[10px] font-bold text-[#0B3D2E]">
                        Populer
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5 text-[#5B6B60]">{plan.vcpus}</td>
                  <td className="px-5 py-3.5 text-[#5B6B60]">{plan.ramMb / 1024} GB</td>
                  <td className="px-5 py-3.5 text-[#5B6B60]">{plan.diskGb} GB</td>
                  <td className="px-5 py-3.5 text-[#5B6B60]">{plan.transferTb} TB</td>
                  <td className="px-5 py-3.5 text-[#5B6B60]">{formatIDR(cycleUnitPrice(plan, "weekly"))}</td>
                  <td className="px-5 py-3.5 text-[#5B6B60]">{formatIDR(cycleUnitPrice(plan, "monthly"))}</td>
                  <td className="px-5 py-3.5 font-semibold text-[#101613]">
                    {formatIDR(cycleUnitPrice(plan, "yearly"))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[#8A9A90]">
          Harga mingguan adalah total untuk 7 hari. Harga tahunan adalah pembayaran di muka untuk 12 bulan. Harga
          dapat berubah mengikuti kurs dan kebijakan penyedia.
        </p>
      </div>
    </div>
  );
}