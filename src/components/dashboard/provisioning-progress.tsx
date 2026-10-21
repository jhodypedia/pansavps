"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, Server, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProvisioningSnapshot = {
  phase: "queued" | "creating" | "booting" | "finalizing" | "active" | "failed";
  progress: number;
  label: string;
  detail: string;
  serverStatus: string | null;
  jobStep: number | null;
  elapsedSeconds: number;
  checkedAt: string;
};

type StatusResponse = {
  status?: string;
  provisioning?: ProvisioningSnapshot | null;
  message?: string;
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatClock(value: string): string {
  return `${new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

export function ProvisioningProgress({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const busy = useRef(false);
  const settled = useRef(false);
  const [snapshot, setSnapshot] = useState<ProvisioningSnapshot | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(
    async (manual = false) => {
      if (busy.current || settled.current) return;
      busy.current = true;
      if (manual) {
        setChecking(true);
        setError(null);
      }
      try {
        const response = await fetch(`/api/status/service/${serviceId}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Status request failed");
        const data = (await response.json().catch(() => ({}))) as StatusResponse;

        if (data.provisioning) setSnapshot(data.provisioning);
        setLastChecked(new Date());
        setError(null);

        if (data.status && data.status !== "provisioning") {
          settled.current = true;
          router.refresh();
        }
      } catch {
        setError("Status terbaru belum dapat dimuat. Kami akan mencoba lagi otomatis.");
      } finally {
        busy.current = false;
        if (manual) setChecking(false);
      }
    },
    [router, serviceId],
  );

  useEffect(() => {
    if (settled.current) return;
    void check(false);
    const timer = window.setInterval(() => void check(false), 4000);
    return () => window.clearInterval(timer);
  }, [check]);

  const progress = Math.min(100, Math.max(0, snapshot?.progress ?? 12));
  const failed = snapshot?.phase === "failed";
  const steps = [
    { label: "Server dibuat", done: progress >= 50, active: progress < 50 },
    { label: "Server aktif", done: progress >= 90, active: progress >= 50 && progress < 90 },
    {
      label: "Konfigurasi selesai",
      done: progress >= 100,
      active: progress >= 90 && progress < 100,
    },
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        failed ? "border-[#FECACA] bg-[#FEF2F2]" : "border-[#FDE68A] bg-[#FFFBEB]",
      )}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                failed ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#FEF3C7] text-[#92400E]",
              )}
            >
              {failed ? (
                <XCircle className="size-5" />
              ) : (
                <Loader2 className="size-5 animate-spin" />
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-bold",
                  failed ? "text-[#991B1B]" : "text-[#92400E]",
                )}
              >
                {failed ? "Server gagal disiapkan" : "Server sedang disiapkan"}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-semibold",
                  failed ? "text-[#991B1B]" : "text-[#92400E]",
                )}
                aria-live="polite"
              >
                {snapshot?.label ?? "Memuat progres server…"}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-xs leading-relaxed",
                  failed ? "text-[#991B1B]/75" : "text-[#92400E]/75",
                )}
              >
                {snapshot?.detail ?? "Mengambil status terbaru."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {snapshot?.serverStatus ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FDE68A] bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[#92400E]">
                <Server className="size-3" /> {snapshot.serverStatus}
              </span>
            ) : null}
            <span
              className={cn(
                "font-display text-2xl font-bold",
                failed ? "text-[#991B1B]" : "text-[#92400E]",
              )}
            >
              {progress}%
            </span>
          </div>
        </div>

        <div
          className={cn(
            "mt-4 h-2 overflow-hidden rounded-full",
            failed ? "bg-[#FEE2E2]" : "bg-[#FDE68A]/70",
          )}
          role="progressbar"
          aria-label="Progres penyiapan server"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              failed ? "bg-[#DC2626]" : "bg-[#D97706]",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#92400E]/65">
          <span>
            {snapshot ? `Berjalan ${formatElapsed(snapshot.elapsedSeconds)}` : "Memulai…"}
          </span>
          <div className="flex items-center gap-2">
            <span>
              {lastChecked
                ? `Diperbarui ${formatClock(lastChecked.toISOString())}`
                : "Memuat status…"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void check(true)}
              disabled={checking}
              className="h-7 border-[#FDE68A] bg-white/70 px-2 text-[11px] text-[#92400E] hover:bg-white"
            >
              {checking ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Cek status
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mt-2 text-[11px] font-medium text-[#92400E]" role="status">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 border-t border-[#FDE68A] bg-white/40 p-4 sm:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.label}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold",
              step.done
                ? "border-[#BFE3CC] bg-[#F3F9F5] text-[#0B3D2E]"
                : step.active
                  ? "border-[#FDE68A] bg-white text-[#92400E]"
                  : "border-[#E3E8E4] bg-white/60 text-[#8A9A90]",
            )}
          >
            {step.done ? (
              <CheckCircle2 className="size-3.5 shrink-0" />
            ) : (
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  step.active ? "bg-[#D97706]" : "bg-[#C9D5CD]",
                )}
              />
            )}
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
}
