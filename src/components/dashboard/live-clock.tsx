"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/time";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "long",
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
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[#E3E8E4] bg-[#F7F8F7] px-3 py-1.5 text-xs text-[#5B6B60]",
        className,
      )}
      aria-live="off"
    >
      <Clock className="size-3.5 shrink-0 text-[#8A9A90]" aria-hidden="true" />
      {now ? (
        <span className="tabular-nums">
          <span className="font-medium text-[#101613]">{dateFormatter.format(now)}</span>
          <span className="mx-1.5 text-[#B8C5BC]">·</span>
          <span>{timeFormatter.format(now)} WIB</span>
        </span>
      ) : (
        <span className="text-[#8A9A90]">Memuat waktu WIB…</span>
      )}
    </span>
  );
}
