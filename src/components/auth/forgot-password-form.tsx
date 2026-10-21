"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Mail } from "lucide-react";
import { forgotPasswordAction } from "@/server/actions/auth";
import type { ActionResult } from "@/server/actions/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(
    forgotPasswordAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-5">
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

      <div className="space-y-2">
        <Label htmlFor="email">Email terdaftar</Label>
        <Input id="email" name="email" type="email" placeholder="nama@email.com" autoComplete="email" required />
        {state?.fieldErrors?.email ? (
          <p className="text-xs text-[#B91C1C]">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <SubmitButton pendingText="Mengirim…" className="h-11 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
        <Mail className="size-4" /> Kirim tautan reset
      </SubmitButton>

      <p className="text-center text-sm text-[#5B6B60]">
        Ingat password?{" "}
        <Link href="/login" className="font-semibold text-[#0B3D2E] hover:underline">
          Kembali masuk
        </Link>
      </p>
    </form>
  );
}
