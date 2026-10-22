"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/lib/toast";

type StatusResponse = {
  ok?: boolean;
  status?: string;
  paidAt?: number | string | null;
  paymentStatus?: string | null;
  message?: string;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function InvoiceStatusWatcher({
  invoiceId,
  status,
  paymentStatus,
}: {
  invoiceId: string;
  status: string;
  paymentStatus?: string | null;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const settled = useRef(false);
  const knownPaymentStatus = useRef(paymentStatus ?? null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    knownPaymentStatus.current = paymentStatus ?? null;
  }, [paymentStatus]);

  const check = useCallback(
    async (manual = false) => {
      if (busy.current || settled.current) return;
      busy.current = true;
      if (manual) {
        setChecking(true);
        setMessage(null);
      }
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/status`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as StatusResponse;
        setLastChecked(new Date());

        if (data.status === "paid") {
          settled.current = true;
          toastSuccess("Pembayaran terkonfirmasi", {
            description: "Invoice sudah lunas. Halaman diperbarui otomatis.",
          });
          router.refresh();
          return;
        }

        const nextPaymentStatus = data.paymentStatus ?? null;
        const changed =
          nextPaymentStatus !== null && nextPaymentStatus !== knownPaymentStatus.current;
        if (changed) knownPaymentStatus.current = nextPaymentStatus;

        if (nextPaymentStatus === "failed") {
          setMessage(
            data.message ??
              "Pembayaran otomatis sebelumnya dibatalkan atau gagal. Invoice masih bisa dibayar ulang.",
          );
          if (changed) router.refresh();
          return;
        }

        if (manual) {
          setMessage(data.message ?? "Pembayaran belum terdeteksi. Coba lagi beberapa saat.");
        }
      } catch {
        if (manual) {
          setMessage("Belum dapat memeriksa status. Periksa koneksi lalu coba lagi.");
        }
      } finally {
        busy.current = false;
        if (manual) setChecking(false);
      }
    },
    [invoiceId, router],
  );

  useEffect(() => {
    if (status === "paid" || status === "cancelled") return;
    const initial = window.setTimeout(() => void check(false), 0);
    const timer = window.setInterval(() => void check(false), 10_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [check, status]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#DCE7E0] bg-gradient-to-r from-white via-[#FBFDFB] to-[#F4FAF6] p-4 shadow-[0_10px_30px_-24px_rgba(11,61,46,0.55)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="relative mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
          <Radio className="size-5" />
          <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-[#22C55E] ring-2 ring-white" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#101613]">Pembayaran dipantau otomatis</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#5B6B60]">
            {status === "expired"
              ? "Invoice sudah kedaluwarsa, tetapi pembayaran yang sudah masuk tetap kami proses otomatis."
              : "Kami cek status pembayaran tiap 10 detik. Kamu nggak perlu refresh manual."}
          </p>
          <p className="mt-1 text-[11px] text-[#8A9A90]" aria-live="polite">
            {lastChecked ? `Terakhir diperiksa ${formatTime(lastChecked)}` : "Memeriksa status pembayaran…"}
          </p>
          {message ? (
            <p className="mt-1 text-[11px] font-medium text-[#92400E]">{message}</p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void check(true)}
        disabled={checking}
        className="shrink-0 border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-[#F3F9F5]"
      >
        {checking ? (
          <Loader2 className="size-4 animate-spin" />
        ) : lastChecked ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {checking ? "Memeriksa…" : "Cek status"}
      </Button>
    </div>
  );
}
