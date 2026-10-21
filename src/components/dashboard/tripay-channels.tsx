"use client";

import { useState } from "react";
import { Check, CreditCard } from "lucide-react";
import type { TripayChannel } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

export function TripayChannelPicker({
  channels,
  name = "paymentChannel",
  value,
  onChange,
  showGroups = true,
  className,
}: {
  channels: TripayChannel[];
  name?: string;
  value?: string;
  onChange?: (code: string) => void;
  showGroups?: boolean;
  className?: string;
}) {
  const [internal, setInternal] = useState(value ?? channels[0]?.code ?? "");
  const selected = value ?? internal;
  const groups = Array.from(new Set(channels.map((channel) => channel.group)));

  function choose(code: string) {
    setInternal(code);
    onChange?.(code);
  }

  function renderChannel(channel: TripayChannel) {
    const active = selected === channel.code;
    return (
      <button
        key={channel.code}
        type="button"
        onClick={() => choose(channel.code)}
        aria-pressed={active}
        className={cn(
          "relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border bg-white px-2 py-3 text-center transition-colors",
          active
            ? "border-[#0B3D2E] bg-[#F3F9F5] ring-1 ring-[#0B3D2E]"
            : "border-[#E3E8E4] hover:border-[#BFE3CC]",
        )}
      >
        {active ? (
          <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-[#0B3D2E] text-white">
            <Check className="size-2.5" />
          </span>
        ) : null}
        {channel.iconUrl ? (
          // Logo berasal dari API pembayaran dan domainnya bisa berubah, jadi pakai img biasa.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.iconUrl}
            alt={channel.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-7 max-w-[86px] object-contain"
          />
        ) : (
          <CreditCard className="size-6 text-[#0B3D2E]" />
        )}
        <span className="line-clamp-2 text-[11px] leading-tight font-semibold text-[#101613]">
          {channel.name}
        </span>
      </button>
    );
  }

  if (channels.length === 0) {
    return (
      <p className={cn("rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E]", className)}>
        Metode pembayaran online belum tersedia.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <input type="hidden" name={name} value={selected} />
      {showGroups ? (
        groups.map((group) => (
          <div key={group} className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-[#8A9A90] uppercase">{group}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {channels.filter((channel) => channel.group === group).map(renderChannel)}
            </div>
          </div>
        ))
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {channels.map(renderChannel)}
        </div>
      )}
    </div>
  );
}
