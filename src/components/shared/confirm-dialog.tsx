"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Info, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "danger" | "warning" | "info";

const variantButton: Record<Variant, string> = {
  danger: "bg-[#DC2626] text-white hover:bg-[#b91c1c]",
  warning: "bg-[#D97706] text-white hover:bg-[#b45309]",
  info: "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]",
};

const variantIcon: Record<Variant, React.ReactNode> = {
  danger: <ShieldAlert className="size-5 text-[#DC2626]" />,
  warning: <AlertTriangle className="size-5 text-[#D97706]" />,
  info: <Info className="size-5 text-[#0B3D2E]" />,
};

export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  variant = "danger",
  requireText,
  onConfirm,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  title: string;
  description: React.ReactNode;
  details?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  requireText?: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [internal, setInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typed, setTyped] = useState("");
  const isControlled = open !== undefined;
  const value = isControlled ? open : internal;
  const setValue = (v: boolean) => {
    if (!isControlled) setInternal(v);
    onOpenChange?.(v);
    setTyped("");
  };

  const canConfirm = !requireText || typed.trim().toLowerCase() === requireText.toLowerCase();

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    if (!canConfirm) return;
    setLoading(true);
    try {
      await onConfirm();
      setValue(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={value} onOpenChange={setValue}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent className="max-w-md rounded-2xl border-[#E3E8E4] bg-white p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <AlertDialogHeader className="gap-3">
            <div
              className={cn(
                "flex size-11 items-center justify-center rounded-full",
                variant === "danger" && "bg-[#FEE2E2]",
                variant === "warning" && "bg-[#FEF3C7]",
                variant === "info" && "bg-[#E7F4EC]",
              )}
            >
              {variantIcon[variant]}
            </div>
            <AlertDialogTitle className="text-left text-xl font-bold text-[#101613]">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left text-sm leading-relaxed text-[#5B6B60]">
                {description}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {details ? (
            <div className="mt-4 rounded-xl border border-[#E3E8E4] bg-[#F7F8F7] p-4 text-sm">
              {details}
            </div>
          ) : null}
          {requireText ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-[#5B6B60]">
                Ketik <span className="font-mono font-bold text-[#101613]">{requireText}</span> untuk
                mengonfirmasi.
              </p>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={requireText}
                autoComplete="off"
                className="font-mono"
              />
            </div>
          ) : null}
        </div>
        <AlertDialogFooter className="border-t border-[#E3E8E4] bg-[#F7F8F7] px-6 py-4">
          <AlertDialogCancel
            disabled={loading}
            className="border-[#E3E8E4] bg-white hover:bg-[#F7F8F7]"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !canConfirm}
            className={cn("gap-2", variantButton[variant])}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {loading ? "Memproses…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
