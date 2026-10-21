import { cn } from "@/lib/utils";
import { statusTone } from "@/lib/format";

const tones = {
  success: "bg-[#E7F4EC] text-[#0B3D2E] border-[#BFE3CC]",
  warning: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
  danger: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]",
  neutral: "bg-[#F1F3F2] text-[#5B6B60] border-[#E3E8E4]",
  info: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
} as const;

export function StatusBadge({
  status,
  label,
  tone,
  dot = true,
  className,
}: {
  status?: string;
  label?: string;
  tone?: keyof typeof tones;
  dot?: boolean;
  className?: string;
}) {
  const resolved = tone ?? (status ? statusTone(status) : "neutral");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        tones[resolved],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            "size-1.5 rounded-full",
            resolved === "success" && "bg-[#16A34A]",
            resolved === "warning" && "bg-[#D97706]",
            resolved === "danger" && "bg-[#DC2626]",
            resolved === "neutral" && "bg-[#8A9A90]",
            resolved === "info" && "bg-[#2563EB]",
          )}
        />
      ) : null}
      {label ?? status}
    </span>
  );
}
