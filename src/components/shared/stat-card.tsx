import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  href,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
  href?: string;
  tone?: "default" | "brand" | "mint" | "warning";
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-2xl border p-5",
        tone === "default" && "border-[#E3E8E4] bg-white",
        tone === "brand" && "border-[#0B3D2E] bg-[#0B3D2E] text-white",
        tone === "mint" && "border-[#CFE6D8] bg-[#E7F4EC]",
        tone === "warning" && "border-[#FDE68A] bg-[#FFFBEB]",
        href && "card-lift",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-sm font-medium",
            tone === "brand" ? "text-white/70" : "text-[#5B6B60]",
          )}
        >
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-xl",
              tone === "brand" ? "bg-white/10 text-white" : "bg-[#E7F4EC] text-[#0B3D2E]",
            )}
          >
            <Icon className="size-4.5" />
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <div
          className={cn(
            "font-display text-2xl font-bold tracking-tight",
            tone === "brand" ? "text-white" : "text-[#101613]",
          )}
        >
          {value}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {trend ? (
            <span
              className={cn(
                "font-semibold",
                trend.positive ? "text-[#15803D]" : "text-[#B91C1C]",
                tone === "brand" && (trend.positive ? "text-[#86EFAC]" : "text-[#FCA5A5]"),
              )}
            >
              {trend.value}
            </span>
          ) : null}
          {hint ? (
            <span className={tone === "brand" ? "text-white/60" : "text-[#8A9A90]"}>{hint}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block h-full">
        {body}
      </a>
    );
  }
  return body;
}
