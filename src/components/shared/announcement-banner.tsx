import Link from "next/link";
import { Info, TriangleAlert, CircleCheck, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnnouncementBanner({
  active,
  text,
  link,
  tone,
}: {
  active: boolean;
  text: string;
  link?: string;
  tone?: string;
}) {
  if (!active || !text) return null;
  const Icon = tone === "warning" ? TriangleAlert : tone === "success" ? CircleCheck : Info;
  return (
    <div
      className={cn(
        "border-b",
        tone === "warning" && "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]",
        tone === "success" && "border-[#BFE3CC] bg-[#E7F4EC] text-[#0B3D2E]",
        (tone === "info" || !tone) && "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]",
      )}
    >
      <div className="ws-container flex items-center gap-3 py-2.5 text-sm">
        <Icon className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 font-medium">{text}</p>
        {link ? (
          <Link href={link} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold hover:underline">
            Selengkapnya <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
