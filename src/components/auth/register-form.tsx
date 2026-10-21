"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, UserPlus } from "lucide-react";
import { registerAction } from "@/server/actions/auth";
import type { ActionResult } from "@/server/actions/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SubmitButton } from "@/components/shared/submit-button";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordFeedback, isPasswordReady } from "@/components/auth/password-feedback";
import {
  scheduleTurnstileReset,
  TurnstileWidget,
  type TurnstileWidgetConfig,
} from "@/components/auth/turnstile-widget";
import { toastSuccess } from "@/lib/toast";

export function RegisterForm({
  next,
  planSlug,
  captcha,
}: {
  next?: string;
  planSlug?: string;
  captcha: TurnstileWidgetConfig;
}) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(registerAction, undefined);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();
  const passwordReady = isPasswordReady(password);
  const confirmMatches = confirmPassword.length > 0 && password === confirmPassword;

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      toastSuccess("Akun berhasil dibuat.", {
        description: planSlug ? "Lanjutkan memesan paket pilihanmu." : "Selamat datang di dashboard.",
      });
      router.push(
        planSlug
          ? `${state.redirectTo.replace(/\/$/, "")}/pesanan/baru?paket=${encodeURIComponent(planSlug)}`
          : state.redirectTo,
      );
      router.refresh();
    }
  }, [state, router, planSlug]);

  return (
    <form action={action} className="space-y-5" onSubmit={() => scheduleTurnstileReset()}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state && !state.ok ? (
        <Alert variant="destructive" className="border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]">
          <CircleAlert className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">Nama lengkap</Label>
        <Input id="name" name="name" placeholder="Nama kamu" autoComplete="name" required />
        {state?.fieldErrors?.name ? (
          <p className="text-xs text-[#B91C1C]">{state.fieldErrors.name[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="nama@email.com" autoComplete="email" required />
        {state?.fieldErrors?.email ? (
          <p className="text-xs text-[#B91C1C]">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Nomor WhatsApp</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="08123456789"
          autoComplete="tel"
          required
        />
        <p className="text-xs text-[#8A9A90]">
          Dipakai untuk verifikasi akun via kode WhatsApp (prioritas) dan notifikasi server.
        </p>
        {state?.fieldErrors?.phone ? (
          <p className="text-xs text-[#B91C1C]">{state.fieldErrors.phone[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          describedBy="password-feedback"
        />
        {state?.fieldErrors?.password ? (
          <p className="text-xs text-[#B91C1C]">{state.fieldErrors.password[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Ulangi password</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          describedBy="password-feedback"
          invalid={confirmPassword.length > 0 && !confirmMatches}
        />
        {state?.fieldErrors?.confirmPassword ? (
          <p className="text-xs text-[#B91C1C]">{state.fieldErrors.confirmPassword[0]}</p>
        ) : null}
      </div>

      <div id="password-feedback">
        <PasswordFeedback password={password} confirmPassword={confirmPassword} />
      </div>

      <div className="flex items-start gap-2.5">
        <Checkbox id="acceptTerms" name="acceptTerms" className="mt-0.5" required />
        <Label htmlFor="acceptTerms" className="text-sm leading-relaxed font-normal text-[#5B6B60]">
          Saya menyetujui{" "}
          <Link href="/syarat-ketentuan" className="font-medium text-[#0B3D2E] hover:underline">
            syarat & ketentuan
          </Link>{" "}
          dan{" "}
          <Link href="/kebijakan-privasi" className="font-medium text-[#0B3D2E] hover:underline">
            kebijakan privasi
          </Link>
          .
        </Label>
      </div>
      {state?.fieldErrors?.acceptTerms ? (
        <p className="text-xs text-[#B91C1C]">{state.fieldErrors.acceptTerms[0]}</p>
      ) : null}

      {captcha.enabled ? <TurnstileWidget siteKey={captcha.siteKey} /> : null}

      <SubmitButton
        pendingText="Membuat akun…"
        disabled={!passwordReady || !confirmMatches}
        className="h-11 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserPlus className="size-4" /> Buat akun
      </SubmitButton>

      <p className="text-center text-sm text-[#5B6B60]">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-[#0B3D2E] hover:underline">
          Masuk
        </Link>
      </p>
    </form>
  );
}
