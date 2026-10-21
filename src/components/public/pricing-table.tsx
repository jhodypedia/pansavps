"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Cpu, Database, Globe2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingCycle } from "@/lib/db/schema";
import { cycleDiscountPercent, cycleUnitPrice, type Plan } from "@/lib/pricing";
import { cycleLabel, formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Cycle = BillingCycle;
const cycles: Cycle[] = ["weekly", "monthly", "quarterly", "yearly"];

export function PricingTable({ items }: { items: Plan[] }) {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-[#D8E2DB] bg-[#F7F8F7] p-1">
          {cycles.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCycle(item)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                cycle === item ? "bg-[#0B3D2E] text-white" : "text-[#5B6B60] hover:text-[#101613]",
              )}
            >
              {cycleLabel[item]}
              {item === "yearly" ? (
                <span className="ml-1.5 rounded-full bg-[#16A34A]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#15803D]">
                  -17%
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {items.map((plan) => {
          const price = cycleUnitPrice(plan, cycle);
          const discount = cycleDiscountPercent(plan, cycle);
          const monthlyEquivalent =
            cycle === "weekly"
              ? Math.round(price * (30 / 7))
              : cycle === "monthly"
                ? price
                : Math.round(price / (cycle === "quarterly" ? 3 : 12));
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex h-full flex-col rounded-2xl border p-6",
                plan.isFeatured ? "border-[#0B3D2E] bg-white shadow-[0_18px_50px_-30px_rgba(11,61,46,0.55)]" : "border-[#E3E8E4] bg-white",
              )}
            >
              {plan.isFeatured ? (
                <span className="absolute -top-3 left-6 rounded-full bg-[#0B3D2E] px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
                  Paling populer
                </span>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#101613]">{plan.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#5B6B60]">{plan.description}</p>
                </div>
                {plan.isFeatured ? (
                  <span className="rounded-full bg-[#E7F4EC] px-2 py-1 text-[10px] font-bold text-[#0B3D2E]">
                    REKOMENDASI
                  </span>
                ) : null}
              </div>

              <div className="mt-6">
                <div className="flex items-end gap-2">
                  <span className="font-display text-3xl font-bold text-[#101613]">{formatIDR(price)}</span>
                  <span className="pb-1 text-sm text-[#5B6B60]">
                    /{cycle === "weekly" ? "minggu" : cycle === "monthly" ? "bulan" : cycle === "quarterly" ? "3 bulan" : "tahun"}
                  </span>
                </div>
                {cycle !== "monthly" ? (
                  <p className="mt-1 text-xs text-[#5B6B60]">
                    Setara {formatIDR(monthlyEquivalent)}/bulan
                    {discount > 0 ? (
                      <span className="ml-1.5 font-semibold text-[#15803D]">· hemat {discount}%</span>
                    ) : cycle === "weekly" ? (
                      <span className="ml-1.5 font-semibold text-[#92400E]">· hapus otomatis 7 hari</span>
                    ) : null}
                  </p>
                ) : (plan.promoPriceMonthly ?? 0) > 0 ? (
                  <p className="mt-1 text-xs text-[#5B6B60]">
                    Harga normal <span className="line-through">{formatIDR(plan.priceMonthly)}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-transparent">.</p>
                )}
              </div>

              <ul className="mt-5 flex flex-col gap-2.5 text-sm text-[#5B6B60]">
                <li className="flex items-center gap-2">
                  <Cpu className="size-4 text-[#0B3D2E]" /> {plan.vcpus} vCPU
                </li>
                <li className="flex items-center gap-2">
                  <Database className="size-4 text-[#0B3D2E]" /> {plan.ramMb / 1024} GB RAM
                </li>
                <li className="flex items-center gap-2">
                  <HardDrive className="size-4 text-[#0B3D2E]" /> {plan.diskGb} GB SSD
                </li>
                <li className="flex items-center gap-2">
                  <Globe2 className="size-4 text-[#0B3D2E]" /> {plan.transferTb} TB transfer
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-[#16A34A]" /> Akses root penuh
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-[#16A34A]" /> IPv4 + IPv6
                </li>
              </ul>

              <div className="mt-auto pt-6">
                <Button asChild className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                  <Link href={`/register?plan=${plan.slug}`}>
                    Pesan sekarang <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-[#8A9A90]">
        Paket mingguan aktif selama 7 hari dan droplet dihapus otomatis saat masa aktif berakhir. Pengingat
        H-1 dikirim melalui notifikasi, email, dan WhatsApp (WIB).
      </p>

      <div className="mt-12 overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
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
                <tr key={plan.id} className="border-b border-[#EDF1EE] last:border-0">
                  <td className="px-5 py-3.5 font-semibold text-[#101613]">{plan.name}</td>
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
      </div>
    </div>
  );
}
