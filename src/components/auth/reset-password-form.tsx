"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, KeyRound } from "lucide-react";
import { resetPasswordAction } from "@/server/actions/auth";
import type { ActionResult } from "@/server/actions/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";
import { PasswordInput } from "@/components/auth/password-input";
import {
  scheduleTurnstileReset,
  TurnstileWidget,
  type TurnstileWidgetConfig,
} from "@/components/auth/turnstile-widget";
import { toastSuccess } from "@/lib/toast";

export function ResetPasswordForm({
  token,
  captcha,
}: {
  token: string;
  captcha: TurnstileWidgetConfig;
}) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(
    resetPasswordAction,
    undefined,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      toastSuccess("Password diperbarui.");
      router.push(state.redirectTo);
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-5" onSubmit={() => scheduleTurnstileReset()}>
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <Alert variant="destructive" className="border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]">
          <CircleAlert className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">Password baru</Label>
        <PasswordInput name="password" autoComplete="new-password" />
        {state?.fieldErrors?.password ? (
          <p className="text-xs text-[#B91C1C]">{state.fieldErrors.password[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Ulangi password baru</Label>
        <PasswordInput name="confirmPassword" autoComplete="new-password" />
        {state?.fieldErrors?.confirmPassword ? (
          <p className="text-xs text-[#B91C1C]">{state.fieldErrors.confirmPassword[0]}</p>
        ) : null}
      </div>

      {captcha.enabled ? <TurnstileWidget siteKey={captcha.siteKey} /> : null}

      <SubmitButton pendingText="Menyimpan…" className="h-11 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
        <KeyRound className="size-4" /> Simpan password baru
      </SubmitButton>

      <p className="text-center text-sm text-[#5B6B60]">
        <Link href="/login" className="font-semibold text-[#0B3D2E] hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </form>
  );
}
