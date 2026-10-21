"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import type { ActionResult } from "@/server/actions/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toastError, toastSuccess } from "@/lib/toast";

export type ServerFormAction = (
  state: ActionResult | undefined,
  formData: FormData,
) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  inlineError = false,
  onSuccess,
}: {
  action: ServerFormAction;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  inlineError?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<ActionResult | undefined>(undefined);

  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) {
      if (!state.silent) toastSuccess(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.();
      if (state.redirectTo) {
        if (/^https?:\/\//.test(state.redirectTo)) {
          window.location.assign(state.redirectTo);
          return;
        }
        router.push(state.redirectTo);
      }
      router.refresh();
    } else if (!state.silent) {
      toastError(state.message);
    }
  }, [state, router, resetOnSuccess, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className={cn("space-y-5", className)}>
      {inlineError && state && !state.ok && !state.silent ? (
        <Alert variant="destructive" className="border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]">
          <CircleAlert className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {children}
    </form>
  );
}

export function FieldError({ errors }: { errors?: string[] }) {
  const id = useId();
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-xs text-[#B91C1C]">
      {errors[0]}
    </p>
  );
}
