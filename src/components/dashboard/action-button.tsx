"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/server/actions/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toastError, toastSuccess } from "@/lib/toast";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type Size = "default" | "sm" | "lg" | "icon" | "xs" | "icon-sm" | "icon-xs";

export function ActionButton({
  action,
  children,
  className,
  variant = "outline",
  size = "sm",
  pendingText,
  disabled,
  confirm,
  successToast = true,
  silent = false,
  onDone,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
  pendingText?: string;
  disabled?: boolean;
  confirm?: string;
  successToast?: boolean;
  silent?: boolean;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          if (successToast && !silent && !result.silent) toastSuccess(result.message);
          onDone?.();
          if (result.redirectTo) {
            if (/^https?:\/\//.test(result.redirectTo)) {
              window.location.assign(result.redirectTo);
              return;
            }
            router.push(result.redirectTo);
          }
          router.refresh();
        } else if (!silent && !result.silent) {
          toastError(result.message);
        }
      } catch {
        if (!silent) toastError("Aksi gagal dijalankan. Coba lagi.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending || disabled}
      onClick={run}
      className={cn("gap-2", className)}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {pending ? pendingText ?? "Memproses…" : children}
    </Button>
  );
}
