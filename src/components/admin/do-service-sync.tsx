"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CloudDownload, Link2, Loader2, Server, Unlink } from "lucide-react";
import { syncDoServicesAction } from "@/server/actions/admin";
import type { DoServiceSyncResult } from "@/lib/do-sync";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

const doStatusStyles: Record<string, string> = {
  active: "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]",
  new: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
  off: "border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563]",
  archive: "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]",
};

export function DoServiceSync() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DoServiceSyncResult | null>(null);
  const router = useRouter();

  function run() {
    startTransition(async () => {
      try {
        const res = await syncDoServicesAction();
        if (!res.ok) {
          toastError(res.message);
          return;
        }
        setResult(res.data ?? null);
        toastSuccess(res.message);
        router.refresh();
      } catch {
        toastError("Gagal mengambil layanan dari DigitalOcean. Coba lagi.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
            <CloudDownload className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#101613]">Ambil layanan dari DigitalOcean</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#5B6B60]">
              Tarik daftar droplet langsung dari API DigitalOcean. Layanan yang cocok lewat ID, tag, atau
              hostname akan disinkronkan otomatis. Droplet di luar toko ditampilkan sebagai belum terhubung.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={run}
          disabled={pending}
          className="shrink-0 gap-2 bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
          {pending ? "Mengambil…" : "Tarik layanan"}
        </Button>
      </div>

      {result ? (
        <div className="mt-5 space-y-4 border-t border-[#EDF1EE] pt-4">
          {result.mock ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E]">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                Mode mock masih aktif. Data di bawah berasal dari simulasi, bukan API DigitalOcean. Matikan
                mode mock di <Link href="/admin/settings?tab=digitalocean" className="font-semibold underline">Pengaturan → DigitalOcean</Link>.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryStat label="Droplet" value={result.fetched} />
            <SummaryStat label="Terhubung" value={result.linked} tone="success" />
            <SummaryStat label="Diperbarui" value={result.updated} />
            <SummaryStat label="Belum terhubung" value={result.untracked} tone={result.untracked > 0 ? "warning" : "default"} />
          </div>

          {result.missing > 0 ? (
            <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E]">
              {result.missing} layanan di database memiliki ID droplet yang tidak ditemukan di DigitalOcean.
              Periksa detail layanan sebelum melakukan tindakan.
            </div>
          ) : null}

          {result.droplets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D8E2DB] bg-[#FBFCFB] px-4 py-8 text-center">
              <Server className="size-6 text-[#8A9A90]" />
              <p className="mt-2 text-sm font-semibold text-[#101613]">Tidak ada droplet ditemukan</p>
              <p className="mt-1 text-xs text-[#8A9A90]">Pastikan mode mock mati dan token DigitalOcean valid.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#E3E8E4]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-[11px] font-semibold tracking-wide text-[#5B6B60] uppercase">
                      <th className="px-3 py-2.5">Droplet</th>
                      <th className="px-3 py-2.5">Status DO</th>
                      <th className="px-3 py-2.5">Region / Size</th>
                      <th className="px-3 py-2.5">IPv4</th>
                      <th className="px-3 py-2.5">Layanan toko</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.droplets.map((droplet) => (
                      <tr key={droplet.id} className="border-b border-[#EDF1EE] last:border-0">
                        <td className="px-3 py-3">
                          <p className="font-mono text-xs font-semibold text-[#101613]">{droplet.name}</p>
                          <p className="mt-0.5 text-[10px] text-[#8A9A90]">
                            ID {droplet.id} · {formatDateTime(droplet.createdAt)}
                          </p>
                          <p className="mt-0.5 text-[10px] font-medium text-[#5B6B60]">
                            Akun: {droplet.accountName}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                              doStatusStyles[droplet.status] ?? "border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563]",
                            )}
                          >
                            {droplet.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-[#5B6B60]">
                          {droplet.region} · {droplet.size}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-[#5B6B60]">{droplet.ipv4 ?? "—"}</td>
                        <td className="px-3 py-3">
                          {droplet.linkedServiceId ? (
                            <Link
                              href={`/admin/services/${droplet.linkedServiceId}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B3D2E] hover:underline"
                            >
                              <Link2 className="size-3.5" />
                              {droplet.linkedHostname}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#92400E]">
                              <Unlink className="size-3.5" />
                              Belum terhubung
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function SummaryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "success"
          ? "border-[#BBF7D0] bg-[#F0FDF4]"
          : tone === "warning"
            ? "border-[#FDE68A] bg-[#FFFBEB]"
            : "border-[#E3E8E4] bg-[#FBFCFB]",
      )}
    >
      <p className="text-lg font-bold text-[#101613]">{value}</p>
      <p className="text-[10px] font-semibold tracking-wide text-[#8A9A90] uppercase">{label}</p>
    </div>
  );
}
