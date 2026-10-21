import Link from "next/link";
import { Server } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  name,
  logoUrl,
  href = "/",
  inverted = false,
  className,
  compact = false,
}: {
  name: string;
  logoUrl?: string | null;
  href?: string;
  inverted?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="h-9 w-auto max-w-[150px] object-contain" />
      ) : (
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            inverted ? "bg-white/10 text-white ring-1 ring-white/15" : "bg-[#0B3D2E] text-white",
          )}
        >
          <Server className="size-5" />
        </span>
      )}
      {!compact ? (
        <span
          className={cn(
            "font-display text-lg font-bold tracking-tight",
            inverted ? "text-white" : "text-[#0B3D2E]",
          )}
        >
          {name}
        </span>
      ) : null}
    </Link>
  );
}
