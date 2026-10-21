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
  Server,
  ShieldCheck,
} from "lucide-react";
import type { Plan } from "@/lib/db/schema";
import { cycleUnitPrice, promoDiscountPercent } from "@/lib/pricing";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";

type Cycle = "monthly" | "weekly";

const specs = [
  { key: "vcpus", icon: Cpu },
  { key: "ram", icon: Database },
  { key: "disk", icon: HardDrive },
  { key: "transfer", icon: Globe2 },
] as const;

export function HomePlanPreview({ plans }: { plans: Plan[] }) {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div>
      <div className="mt-8 flex flex-col items-center gap-2.5">
        <div
          className="inline-flex items-center rounded-full border border-[#D8E2DB] bg-[#F7F8F7] p-1"
          role="group"
          aria-label="Pilih siklus harga"
        >
          {(["monthly", "weekly"] as Cycle[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCycle(item)}
              aria-pressed={cycle === item}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-all",
                cycle === item
                  ? "bg-[#0B3D2E] text-white shadow-sm"
                  : "text-[#5B6B60] hover:text-[#101613]",
              )}
            >
              {item === "monthly" ? "Bulanan" : "Mingguan"}
              {item === "weekly" ? (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    cycle === "weekly" ? "bg-white/15 text-white" : "bg-[#E7F4EC] text-[#0B3D2E]",
                  )}
                >
                  7 hari
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="text-center text-xs leading-relaxed text-[#8A9A90]">
          {cycle === "weekly"
            ? "VPS mingguan aktif 7 hari, lalu dihapus otomatis. Pengingat H-1 dikirim via email dan WhatsApp."
            : "Bayar per bulan dan aktifkan perpanjangan otomatis agar layanan tidak terputus."}
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {plans.map((plan, index) => {
          const featured = plan.isFeatured;
          const price = cycleUnitPrice(plan, cycle);
          const discount = cycle === "monthly" ? promoDiscountPercent(plan) : 0;

          return (
            <Reveal key={plan.id} delay={index * 0.06} className="h-full">
              <div
                className={cn(
                  "group relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border p-6 transition duration-300",
                  featured
                    ? "border-[#0B3D2E] bg-[#0B3D2E] text-white shadow-[0_28px_70px_-38px_rgba(11,61,46,0.9)]"
                    : "border-[#E3E8E4] bg-white shadow-[0_1px_0_rgba(16,22,19,0.03)] hover:-translate-y-1 hover:border-[#A9C8B3] hover:shadow-[0_24px_60px_-40px_rgba(11,61,46,0.45)]",
                )}
              >
                {featured ? (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                      background:
                        "radial-gradient(circle at 100% 0%, rgba(74,222,128,0.18), transparent 38%), radial-gradient(circle at 0% 100%, rgba(22,163,74,0.14), transparent 42%)",
                    }}
                    aria-hidden
                  />
                ) : null}

                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    {featured ? (
                      <span className="mb-3 inline-flex rounded-full bg-[#16A34A] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white uppercase">
                        Paling populer
                      </span>
                    ) : null}
                    <h3
                      className={cn(
                        "font-display text-lg font-bold",
                        featured ? "text-white" : "text-[#101613]",
                      )}
                    >
                      {plan.name}
                    </h3>
                    <p
                      className={cn(
                        "mt-1 max-w-[15rem] text-sm leading-relaxed",
                        featured ? "text-white/65" : "text-[#5B6B60]",
                      )}
                    >
                      {plan.description}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      featured ? "bg-white/10 text-white" : "bg-[#E7F4EC] text-[#0B3D2E]",
                    )}
                  >
                    <Server className="size-5" />
                  </span>
                </div>

                <div className="relative mt-5 flex items-end gap-2">
                  <span
                    className={cn(
                      "font-display text-3xl font-bold",
                      featured ? "text-white" : "text-[#101613]",
                    )}
                  >
                    {formatIDR(price)}
                  </span>
                  <span
                    className={cn(
                      "pb-1 text-sm",
                      featured ? "text-white/60" : "text-[#5B6B60]",
                    )}
                  >
                    /{cycle === "weekly" ? "minggu" : "bulan"}
                  </span>
                </div>

                <div className="relative mt-2 flex min-h-5 items-center gap-2 text-xs">
                  {cycle === "weekly" ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 font-semibold text-[#92400E]">
                        <ShieldCheck className="size-3" /> Hapus otomatis
                      </span>
                      <span className={featured ? "text-white/45" : "text-[#8A9A90]"}>aktif 7 hari</span>
                    </>
                  ) : discount > 0 ? (
                    <>
                      <span className={featured ? "text-white/50 line-through" : "text-[#8A9A90] line-through"}>
                        {formatIDR(plan.priceMonthly)}
                      </span>
                      <span className="rounded-full bg-[#16A34A]/15 px-2 py-0.5 font-bold text-[#16A34A]">
                        Hemat {discount}%
                      </span>
                    </>
                  ) : (
                    <span className={featured ? "text-white/45" : "text-[#8A9A90]"}>
                      Aktivasi otomatis setelah pembayaran
                    </span>
                  )}
                </div>

                <ul
                  className={cn(
                    "relative mt-5 flex flex-col gap-2.5 text-sm",
                    featured ? "text-white/80" : "text-[#5B6B60]",
                  )}
                >
                  {specs.map((item) => {
                    const Icon = item.icon;
                    const value =
                      item.key === "vcpus"
                        ? `${plan.vcpus} vCPU`
                        : item.key === "ram"
                          ? `${plan.ramMb / 1024} GB RAM`
                          : item.key === "disk"
                            ? `${plan.diskGb} GB SSD`
                            : `${plan.transferTb} TB transfer`;
                    return (
                      <li key={item.key} className="flex items-center gap-2">
                        <Icon className="size-4 shrink-0" /> {value}
                      </li>
                    );
                  })}
                </ul>

                <div className="relative mt-auto pt-6">
                  <Button
                    asChild
                    className={cn(
                      "w-full",
                      featured
                        ? "bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]"
                        : "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]",
                    )}
                  >
                    <Link href={`/register?plan=${plan.slug}`}>
                      Pesan {plan.name} <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <p
                    className={cn(
                      "mt-2.5 flex items-center justify-center gap-1.5 text-[11px]",
                      featured ? "text-white/45" : "text-[#8A9A90]",
                    )}
                  >
                    <Check className="size-3" /> Tanpa biaya setup
                  </p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
