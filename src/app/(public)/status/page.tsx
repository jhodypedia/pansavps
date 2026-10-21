import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Clock, HelpCircle, Server } from "lucide-react";
import { db } from "@/lib/db";
import { cronLogs } from "@/lib/db/schema";
import { getPublicBrand } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Status Server",
  description: "Status server PansaVPS secara langsung.",
};

type ServerState = "online" | "partial" | "offline" | "unknown";

function resolveState(status: string | undefined): ServerState {
  if (!status) return "unknown";
  if (status === "success") return "online";
  if (status === "partial") return "partial";
  return "offline";
}

const stateDisplay: Record<
  ServerState,
  {
    label: string;
    description: string;
    iconWrap: string;
    icon: string;
    pill: string;
    dot: string;
    Icon: typeof CheckCircle2;
  }
> = {
  online: {
    label: "Server online",
    description: "Semua layanan server beroperasi normal.",
    iconWrap: "bg-[#E7F4EC]",
    icon: "text-[#0B3D2E]",
    pill: "border-[#BFE3CC] bg-[#E7F4EC] text-[#0B3D2E]",
    dot: "bg-[#16A34A]",
    Icon: CheckCircle2,
  },
  partial: {
    label: "Gangguan sebagian",
    description: "Sebagian pemeriksaan server mengalami gangguan.",
    iconWrap: "bg-[#FFFBEB]",
    icon: "text-[#92400E]",
    pill: "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]",
    dot: "bg-[#D97706]",
    Icon: AlertTriangle,
  },
  offline: {
    label: "Server offline",
    description: "Pemeriksaan server terakhir gagal. Tim sedang menangani.",
    iconWrap: "bg-[#FEE2E2]",
    icon: "text-[#991B1B]",
    pill: "border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]",
    dot: "bg-[#DC2626]",
    Icon: AlertTriangle,
  },
  unknown: {
    label: "Menunggu pemeriksaan",
    description: "Belum ada data pemeriksaan server.",
    iconWrap: "bg-[#F3F4F6]",
    icon: "text-[#4B5563]",
    pill: "border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563]",
    dot: "bg-[#9CA3AF]",
    Icon: HelpCircle,
  },
};

export default function StatusPage() {
  const brand = getPublicBrand();
  const latest = db
    .select()
    .from(cronLogs)
    .all()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const state = resolveState(latest?.status);
  const display = stateDisplay[state];
  const StatusIcon = display.Icon;

  return (
    <>
      <section className="border-b border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container py-12 md:py-16">
          <Badge className="border border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-white">
            Status Server
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">
            Status server {brand.siteName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5B6B60]">
            Satu tampilan untuk melihat kondisi server. Status diperbarui dari pemeriksaan otomatis
            sistem.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="ws-container max-w-3xl">
          <div className="overflow-hidden rounded-3xl border border-[#E3E8E4] bg-white shadow-[0_12px_40px_rgba(16,22,19,0.04)]">
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
              <div className="flex items-start gap-4">
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${display.iconWrap} ${display.icon}`}
                >
                  <Server className="size-6" />
                </span>
                <div>
                  <p className="text-xs font-bold tracking-wide text-[#8A9A90] uppercase">
                    Status server
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#101613]">
                    {display.label}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-[#5B6B60]">
                    {display.description}
                  </p>
                </div>
              </div>

              <div
                className={`inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-semibold ${display.pill}`}
              >
                <span className={`size-2 rounded-full ${display.dot}`} />
                {display.label}
              </div>
            </div>

            <div className="grid gap-4 border-t border-[#EEF2EF] bg-[#FBFCFB] p-6 sm:grid-cols-2 sm:p-8">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-[#0B3D2E]" />
                <div>
                  <p className="text-xs font-semibold text-[#8A9A90]">Pemeriksaan terakhir</p>
                  <p className="mt-1 text-sm font-semibold text-[#101613]">
                    {latest ? formatDateTime(latest.finishedAt) : "Belum tersedia"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Activity className="mt-0.5 size-4 shrink-0 text-[#0B3D2E]" />
                <div>
                  <p className="text-xs font-semibold text-[#8A9A90]">Sumber status</p>
                  <p className="mt-1 text-sm font-semibold text-[#101613]">Monitoring otomatis</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#E3E8E4] bg-[#FBFCFB] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <StatusIcon className="mt-0.5 size-4 shrink-0 text-[#0B3D2E]" />
              <p className="text-sm leading-relaxed text-[#5B6B60]">
                Mengalami kendala pada server? Hubungi support agar kami bisa membantu.
              </p>
            </div>
            <Link
              href="/kontak"
              className="shrink-0 text-sm font-semibold text-[#0B3D2E] underline-offset-4 hover:underline"
            >
              Hubungi support
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
