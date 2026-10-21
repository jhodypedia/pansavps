"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ArrowUpRight, Search } from "lucide-react";

export type SearchItem = { label: string; href: string; group: string };

export function CommandMenu({
  items,
  triggerLabel = "Cari menu…",
}: {
  items: SearchItem[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = Array.from(new Set(items.map((item) => item.group)));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E3E8E4] bg-[#FBFCFB] px-3 text-sm text-[#8A9A90] transition-colors hover:border-[#CFE6D8] hover:text-[#0B3D2E] md:w-64"
        aria-label="Buka pencarian"
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left md:inline">{triggerLabel}</span>
        <kbd className="hidden rounded border border-[#E3E8E4] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#8A9A90] md:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Pencarian" description="Cari halaman atau menu">
        <CommandInput placeholder="Ketik untuk mencari halaman atau aksi…" />
        <CommandList>
          <CommandEmpty>Tidak ada hasil.</CommandEmpty>
          {groups.map((group) => (
            <div key={group}>
              <CommandGroup heading={group}>
                {items
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <CommandItem
                      key={item.href + item.label}
                      value={`${item.label} ${item.href}`}
                      onSelect={() => {
                        setOpen(false);
                        router.push(item.href);
                      }}
                    >
                      <ArrowUpRight className="size-4 text-[#8A9A90]" />
                      <span>{item.label}</span>
                      <span className="ml-auto hidden font-mono text-[10px] text-[#8A9A90] sm:inline">
                        {item.href}
                      </span>
                    </CommandItem>
                  ))}
              </CommandGroup>
              <CommandSeparator />
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
