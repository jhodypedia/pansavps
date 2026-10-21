"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  KeyRound,
  Loader2,
  MailCheck,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import {
  resendVerificationAction,
  verifyEmailAction,
  verifyPhoneCodeAction,
} from "@/server/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastSuccess, toastError } from "@/lib/toast";

type ResendData = { retryAfterSeconds?: number };

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function VerifyAccountPanel({
  token,
  signedIn,
}: {
  token?: string;
  signedIn: boolean;
}) {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [code, setCode] = useState("");
  const router = useRouter();
  const resendRemaining = cooldownUntil > now ? Math.ceil((cooldownUntil - now) / 1000) : 0;

  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownUntil) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  function finish(result: { ok: boolean; message: string; redirectTo?: string }) {
    setState({ ok: result.ok, message: result.message });
    if (result.ok) {
      toastSuccess("Akun terverifikasi.");
      router.push(result.redirectTo ?? "/dashboard");
      router.refresh();
    } else {
      toastError(result.message);
    }
  }

  function verifyToken() {
    if (!token) return;
    startTransition(async () => {
      finish(await verifyEmailAction(token));
    });
  }

  function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6) return;
    startTransition(async () => {
      finish(await verifyPhoneCodeAction(code));
    });
  }

  function resend() {
    startTransition(async () => {
      const result = await resendVerificationAction();
      const data = result.data as ResendData | undefined;
      setState({ ok: result.ok, message: result.message });

      const retryAfter = data?.retryAfterSeconds ?? (result.ok ? 60 : 0);
      if (retryAfter > 0) {
        const current = Date.now();
        setNow(current);
        setCooldownUntil(current + retryAfter * 1000);
      }
      if (!result.ok) toastError(result.message);
    });
  }

  return (
    <div className="space-y-5">
      {state ? (
        <Alert
          className={
            state.ok
              ? "border-[#BFE3CC] bg-[#E7F4EC] text-[#0B3D2E]"
              : "border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]"
          }
        >
          {state.ok ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {token ? (
        <div className="space-y-4 rounded-xl border border-[#E3E8E4] bg-[#FBFCFB] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
              <MailCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#101613]">Verifikasi email</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#5B6B60]">
                Klik tombol di bawah untuk memverifikasi email dan membuka akses pembelian.
              </p>
            </div>
          </div>
          <Button
            onClick={verifyToken}
            disabled={pending}
            className="h-11 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {pending ? "Memverifikasi…" : "Verifikasi email saya"}
          </Button>
        </div>
      ) : null}

      {signedIn ? (
        <div className="space-y-4 rounded-xl border border-[#E3E8E4] bg-[#FBFCFB] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
              <MessageCircle className="size-4" />
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-[#101613]">
                <KeyRound className="size-3.5" /> Kode verifikasi WhatsApp
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#5B6B60]">
                Masukkan 6 digit kode yang kami kirim ke WhatsApp. WhatsApp diprioritaskan karena
                kodenya langsung terlihat di aplikasi.
              </p>
            </div>
          </div>
          <form onSubmit={verifyCode} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="verification-code">Kode 6 digit</Label>
              <Input
                id="verification-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="text-center font-mono text-lg tracking-[0.35em]"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={pending || code.length !== 6}
              className="h-11 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {pending ? "Memverifikasi…" : "Verifikasi kode"}
            </Button>
          </form>
          <Button
            type="button"
            onClick={resend}
            disabled={pending || resendRemaining > 0}
            variant="outline"
            className="h-10 w-full border-[#D8E2DB] bg-white text-[#0B3D2E]"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {resendRemaining > 0
              ? `Kirim ulang dalam ${formatCountdown(resendRemaining)}`
              : "Kirim ulang kode / tautan"}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-[#8A9A90]">
            Bisa kirim ulang setelah 60 detik, maksimal 3 permintaan per 10 menit. Jika SMTP sudah
            dikonfigurasi, tautan verifikasi juga dikirim ke email. Kode WhatsApp berlaku 10 menit.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm leading-relaxed text-[#92400E]">
          Masuk ke akun terlebih dahulu untuk memasukkan kode verifikasi WhatsApp.
        </div>
      )}

      {!token && !signedIn ? (
        <Button asChild className="h-11 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
          <Link href="/login?next=/verifikasi-akun">Masuk untuk verifikasi</Link>
        </Button>
      ) : null}

      <p className="text-center text-sm text-[#5B6B60]">
        <Link href="/dashboard" className="font-semibold text-[#0B3D2E] hover:underline">
          Lanjut ke dashboard
        </Link>
      </p>
    </div>
  );
}
