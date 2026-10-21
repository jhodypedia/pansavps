"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toastSuccess } from "@/lib/toast";

export function CopyButton({
  value,
  label = "Salin",
  className,
  size = "sm",
}: {
  value: string;
  label?: string;
  className?: string;
  size?: "sm" | "xs" | "icon" | "icon-sm";
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toastSuccess("Disalin ke clipboard.");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toastSuccess("Gagal menyalin. Salin manual ya.");
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={copy}
      className={cn("gap-1.5 border-[#D8E2DB] bg-white text-[#0B3D2E] hover:bg-[#F3F9F5]", className)}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {label ? (copied ? "Tersalin" : label) : null}
    </Button>
  );
}
