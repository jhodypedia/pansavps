"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BalanceHistoryItem = {
  id: string;
  type: "topup" | "payment" | "refund" | "adjustment";
  amount: number;
  balanceAfter: number;
  ref: string | null;
  note: string | null;
  createdAt: string;
};

type Filter = "all" | "in" | "out" | "refund";
type PageItem = number | "ellipsis";

const PAGE_SIZE = 8;

const typeLabels: Record<BalanceHistoryItem["type"], string> = {
  topup: "Top up saldo",
  payment: "Pembayaran VPS",
  refund: "Refund ke saldo",
  adjustment: "Penyesuaian saldo",
};

const typeDescriptions: Record<BalanceHistoryItem["type"], string> = {
  topup: "Dana yang ditambahkan ke saldo akun.",
  payment: "Saldo yang dipakai untuk membayar layanan.",
  refund: "Dana yang dikembalikan ke saldo akun.",
  adjustment: "Perubahan saldo dari penyesuaian admin.",
};

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "in", label: "Masuk" },
  { id: "out", label: "Keluar" },
  { id: "refund", label: "Refund" },
];

function pageList(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages: PageItem[] = [1];
  if (current > 4) pages.push("ellipsis");
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
    pages.push(page);
  }
  if (current < total - 3) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

function referenceHref(ref: string | null) {
  if (!ref) return null;
  if (ref.startsWith("inv_")) return `/dashboard/invoices/${ref}`;
  if (ref.startsWith("ord_")) return `/dashboard/pesanan/${ref}`;
  return null;
}

function referenceLabel(ref: string | null) {
  if (!ref) return null;
  if (ref.startsWith("inv_")) return "Buka invoice";
  if (ref.startsWith("ord_")) return "Buka pesanan";
  return null;
}

export function BalanceHistory({ items }: { items: BalanceHistoryItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BalanceHistoryItem | null>(null);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "in" && item.amount <= 0) return false;
      if (filter === "out" && item.amount >= 0) return false;
      if (filter === "refund" && item.type !== "refund") return false;
      if (!keyword) return true;

      const haystack = [
        typeLabels[item.type],
        item.note ?? "",
        item.ref ?? "",
        formatIDR(item.amount),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [filter, items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function chooseFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  function changeQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  const selectedPositive = (selected?.amount ?? 0) > 0;
  const selectedRefHref = referenceHref(selected?.ref ?? null);

  return (
    <>
      <div className="border-b border-[#EDF1EE] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter riwayat transaksi">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseFilter(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === item.id
                    ? "border-[#0B3D2E] bg-[#0B3D2E] text-white"
                    : "border-[#E3E8E4] bg-white text-[#5B6B60] hover:border-[#A9C8B3] hover:text-[#101613]",
                )}
                aria-pressed={filter === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-56">
            <span className="sr-only">Cari transaksi</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#8A9A90]" />
            <input
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="Cari transaksi…"
              className="h-9 w-full rounded-xl border border-[#E3E8E4] bg-white pr-3 pl-8 text-xs text-[#101613] outline-none transition-colors placeholder:text-[#8A9A90] focus:border-[#0B3D2E]"
            />
          </label>
        </div>
      </div>

      <div className="max-h-[560px] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        {visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[#E7F4EC] text-[#0B3D2E]">
              <History className="size-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-[#101613]">Belum ada transaksi</p>
            <p className="mt-1 text-xs text-[#5B6B60]">
              {items.length === 0
                ? "Saldo akan muncul setelah top up atau refund."
                : "Tidak ada transaksi yang cocok dengan filter atau pencarian."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#EDF1EE]">
            {visible.map((tx) => {
              const positive = tx.amount > 0;
              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(tx)}
                    className="group flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-[#FBFCFB] focus-visible:bg-[#F3F9F5] focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                        positive ? "bg-[#E7F4EC] text-[#15803D]" : "bg-[#FEF3C7] text-[#92400E]",
                      )}
                    >
                      {positive ? (
                        <ArrowDownLeft className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[#101613]">
                            {typeLabels[tx.type]}
                          </p>
                          {tx.type === "refund" ? (
                            <span className="rounded-full bg-[#E7F4EC] px-2 py-0.5 text-[10px] font-bold text-[#0B3D2E]">
                              Dana kembali
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={cn(
                            "text-sm font-bold whitespace-nowrap",
                            positive ? "text-[#15803D]" : "text-[#991B1B]",
                          )}
                        >
                          {positive ? "+" : ""}
                          {formatIDR(tx.amount)}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-[#5B6B60]">
                        {tx.note ?? tx.ref ?? "—"}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#8A9A90]">
                        <span>{formatDateTime(tx.createdAt)}</span>
                        <span>Saldo akhir {formatIDR(tx.balanceAfter)}</span>
                      </p>
                    </div>
                    <ChevronRight className="mt-2 size-4 shrink-0 text-[#C4D0C8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0B3D2E]" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-[#EDF1EE] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-[11px] text-[#8A9A90]">
          Menampilkan {start}–{end} dari {filtered.length} transaksi
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-[#E3E8E4]"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-xs font-semibold text-[#5B6B60] sm:hidden">
            {currentPage} / {totalPages}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {pageList(currentPage, totalPages).map((item, index) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-1.5 text-xs text-[#8A9A90]">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === currentPage ? "default" : "outline"}
                  size="icon-sm"
                  className={cn(
                    "text-xs",
                    item === currentPage
                      ? "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
                      : "border-[#E3E8E4]",
                  )}
                  onClick={() => setPage(item)}
                  aria-label={`Halaman ${item}`}
                  aria-current={item === currentPage ? "page" : undefined}
                >
                  {item}
                </Button>
              ),
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-[#E3E8E4]"
            disabled={currentPage === totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl",
                      selectedPositive
                        ? "bg-[#E7F4EC] text-[#15803D]"
                        : "bg-[#FEF3C7] text-[#92400E]",
                    )}
                  >
                    {selectedPositive ? (
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                  </span>
                  {typeLabels[selected.type]}
                </DialogTitle>
                <DialogDescription>{typeDescriptions[selected.type]}</DialogDescription>
              </DialogHeader>

              <div className="rounded-2xl border border-[#E3E8E4] bg-[#F7F8F7] p-4 text-center">
                <p className="text-[11px] font-semibold tracking-wide text-[#8A9A90] uppercase">
                  Nominal transaksi
                </p>
                <p
                  className={cn(
                    "mt-1 font-display text-3xl font-bold tracking-tight",
                    selectedPositive ? "text-[#15803D]" : "text-[#991B1B]",
                  )}
                >
                  {selectedPositive ? "+" : ""}
                  {formatIDR(selected.amount)}
                </p>
                {selected.type === "refund" ? (
                  <span className="mt-2 inline-flex rounded-full bg-[#E7F4EC] px-2.5 py-1 text-[10px] font-bold text-[#0B3D2E]">
                    Dana kembali ke saldo
                  </span>
                ) : null}
              </div>

              <dl className="divide-y divide-[#EDF1EE]">
                <DetailRow label="Waktu" value={formatDateTime(selected.createdAt)} />
                <DetailRow label="Saldo sebelum" value={formatIDR(selected.balanceAfter - selected.amount)} />
                <DetailRow label="Saldo setelah" value={formatIDR(selected.balanceAfter)} />
                <DetailRow label="Referensi" value={selected.ref ?? "—"} mono />
                <DetailRow label="ID transaksi" value={selected.id} mono />
                {selected.note ? <DetailRow label="Catatan" value={selected.note} /> : null}
              </dl>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {selectedRefHref && referenceLabel(selected.ref) ? (
                  <Button asChild variant="outline" className="border-[#E3E8E4]">
                    <Link href={selectedRefHref}>
                      {referenceLabel(selected.ref)} <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
                  onClick={() => setSelected(null)}
                >
                  Tutup
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs text-[#5B6B60]">{label}</dt>
      <dd
        className={cn(
          "max-w-[66%] text-right text-xs font-semibold break-words text-[#101613]",
          mono && "font-mono text-[11px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
