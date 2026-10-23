"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/time";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const firstTick = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);

    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <span
      className={cn("inline-flex items-center gap-2 whitespace-nowrap", className)}
      aria-live="off"
      title="Waktu Indonesia Barat"
    >
      <Clock className="hidden size-3.5 shrink-0 text-[#8A9A90] sm:block" aria-hidden="true" />
      <span className="flex flex-col leading-none">
        <span className="text-[9px] font-medium tracking-wide text-[#8A9A90] sm:text-[10px]">
          {now ? dateFormatter.format(now) : "Tanggal WIB"}
        </span>
        <span className="mt-0.5 text-[11px] font-semibold tabular-nums text-[#101613] sm:mt-1 sm:text-xs">
          {now ? timeFormatter.format(now) : "--:--:--"}{" "}
          <span className="font-normal text-[#8A9A90]">WIB</span>
        </span>
      </span>
    </span>
  );
}
