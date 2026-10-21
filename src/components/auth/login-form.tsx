"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, LogIn } from "lucide-react";
import { loginAction } from "@/server/actions/auth";
import type { ActionResult } from "@/server/actions/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";
import { PasswordInput } from "@/components/auth/password-input";
import { toastSuccess } from "@/lib/toast";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(loginAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      toastSuccess("Berhasil masuk.");
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state && !state.ok ? (
        <Alert variant="destructive" className="border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]">
          <CircleAlert className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="nama@email.com"
          autoComplete="email"
          required
          aria-invalid={Boolean(state?.fieldErrors?.email)}
        />
        {state?.fieldErrors?.email ? (
          <p className="text-xs text-[#B91C1C]">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-[#0B3D2E] hover:underline">
            Lupa password?
          </Link>
        </div>
        <PasswordInput name="password" autoComplete="current-password" />
      </div>

      <SubmitButton
        pendingText="Masuk…"
        className="h-11 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
      >
        <LogIn className="size-4" /> Masuk
      </SubmitButton>

      <p className="text-center text-sm text-[#5B6B60]">
        Belum punya akun?{" "}
        <Link href="/register" className="font-semibold text-[#0B3D2E] hover:underline">
          Daftar gratis
        </Link>
      </p>
    </form>
  );
}
