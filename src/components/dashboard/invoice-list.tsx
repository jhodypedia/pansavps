"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Receipt,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  formatDateShort,
  formatDateTime,
  formatIDR,
  formatRelative,
  invoiceStatusLabel,
  invoiceTypeLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  rawStatus: string;
  amount: number;
  createdAt: string;
  dueDate: string | null;
  paidAt: string | null;
  planName: string | null;
  orderNumber: string | null;
};

type Filter = "all" | "unpaid" | "failed" | "paid" | "refunded" | "expired" | "cancelled";
type PageItem = number | "ellipsis";

const PAGE_SIZE = 8;

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "unpaid", label: "Menunggu" },
  { id: "failed", label: "Gagal" },
  { id: "paid", label: "Lunas" },
  { id: "refunded", label: "Dikembalikan" },
  { id: "expired", label: "Kedaluwarsa" },
  { id: "cancelled", label: "Dibatalkan" },
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

function statusIcon(status: string) {
  if (status === "unpaid") return Clock3;
  if (status === "paid") return CheckCircle2;
  if (status === "refunded") return RotateCcw;
  if (status === "expired" || status === "cancelled" || status === "failed") return XCircle;
  return FileText;
}

function statusIconClass(status: string) {
  if (status === "unpaid") return "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]";
  if (status === "paid") return "border-[#BFE3CC] bg-[#E7F4EC] text-[#15803D]";
  if (status === "refunded") return "border-[#E3E8E4] bg-[#F7F8F7] text-[#5B6B60]";
  return "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]";
}

function timelineText(invoice: InvoiceListItem) {
  if (invoice.status === "unpaid") {
    return invoice.dueDate ? `Jatuh tempo ${formatRelative(invoice.dueDate)}` : "Menunggu pembayaran";
  }
  if (invoice.status === "paid") {
    return invoice.paidAt ? `Dibayar ${formatDateShort(invoice.paidAt)}` : "Pembayaran lunas";
  }
  if (invoice.status === "refunded") {
    return invoice.paidAt
      ? `Dana dikembalikan ${formatDateShort(invoice.paidAt)}`
      : "Dana sudah dikembalikan";
  }
  if (invoice.status === "failed") return "Pembayaran otomatis gagal";
  if (invoice.status === "expired") return "Invoice kedaluwarsa";
  if (invoice.status === "cancelled") return "Invoice dibatalkan";
  return formatDateShort(invoice.createdAt);
}

export function InvoiceList({ items }: { items: InvoiceListItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      all: items.length,
      unpaid: 0,
      failed: 0,
      paid: 0,
      refunded: 0,
      expired: 0,
      cancelled: 0,
    };
    for (const item of items) {
      if (item.status in result) result[item.status as Filter] += 1;
    }
    return result;
  }, [items]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!keyword) return true;

      const haystack = [
        item.invoiceNumber,
        item.planName ?? "",
        item.orderNumber ?? "",
        invoiceTypeLabel[item.type] ?? item.type,
        invoiceStatusLabel[item.status] ?? item.status,
        String(item.amount),
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

  return (
    <>
      <div className="border-b border-[#EDF1EE] p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter invoice">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseFilter(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === item.id
                    ? "border-[#0B3D2E] bg-[#0B3D2E] text-white"
                    : "border-[#E3E8E4] bg-white text-[#5B6B60] hover:border-[#A9C8B3] hover:text-[#101613]",
                )}
                aria-pressed={filter === item.id}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold",
                    filter === item.id
                      ? "bg-white/15 text-white"
                      : "bg-[#F1F3F2] text-[#5B6B60]",
                  )}
                >
                  {counts[item.id]}
                </span>
              </button>
            ))}
          </div>
          <label className="relative block xl:w-64">
            <span className="sr-only">Cari invoice</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#8A9A90]" />
            <input
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="Cari invoice, paket, order…"
              className="h-9 w-full rounded-xl border border-[#E3E8E4] bg-white pr-3 pl-8 text-xs text-[#101613] outline-none transition-colors placeholder:text-[#8A9A90] focus:border-[#0B3D2E]"
            />
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#E7F4EC] text-[#0B3D2E]">
            <Receipt className="size-5" />
          </span>
          <p className="mt-4 text-sm font-bold text-[#101613]">
            {items.length === 0 ? "Belum ada invoice" : "Tidak ada invoice yang cocok"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#5B6B60]">
            {items.length === 0
              ? "Invoice bakal muncul setelah kamu memesan VPS, memperpanjang layanan, atau top up."
              : "Coba ubah filter atau kata kunci pencarian."}
          </p>
          {items.length === 0 ? (
            <Button asChild className="mt-5 bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href="/dashboard/pesanan/baru">
                Pesan VPS <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-[#EDF1EE]">
          {visible.map((invoice) => {
            const Icon = statusIcon(invoice.status);
            const unpaid = invoice.rawStatus === "unpaid";
            const typeLabel = invoiceTypeLabel[invoice.type] ?? invoice.type;

            return (
              <li key={invoice.id} className="transition-colors hover:bg-[#FBFCFB]">
                <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border",
                        statusIconClass(invoice.status),
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="font-mono text-xs font-bold tracking-tight text-[#0B3D2E] hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                        <StatusBadge
                          status={invoice.status}
                          label={invoiceStatusLabel[invoice.status] ?? invoice.status}
                        />
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-[#101613]">
                        {invoice.planName || typeLabel}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8A9A90]">
                        {invoice.planName ? <span>{typeLabel}</span> : null}
                        {invoice.orderNumber ? (
                          <span className="font-mono">{invoice.orderNumber}</span>
                        ) : null}
                        <span>Dibuat {formatDateTime(invoice.createdAt)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-4 border-t border-[#F1F3F2] pt-3 lg:border-0 lg:pt-0">
                    <div className="text-left lg:min-w-[170px] lg:text-right">
                      <p className="font-display text-lg font-bold tracking-tight text-[#101613]">
                        {formatIDR(invoice.amount)}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-[11px]",
                          unpaid ? "font-semibold text-[#B45309]" : "text-[#8A9A90]",
                        )}
                      >
                        {timelineText(invoice)}
                      </p>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      variant={unpaid ? "default" : "outline"}
                      className={cn(
                        "shrink-0",
                        unpaid
                          ? "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
                          : "border-[#D8E2DB] bg-white text-[#0B3D2E] hover:bg-[#F3F9F5]",
                      )}
                    >
                      <Link href={`/dashboard/invoices/${invoice.id}`}>
                        {unpaid ? "Bayar" : "Detail"} <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-[#EDF1EE] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[11px] text-[#8A9A90]">
            Menampilkan {start}–{end} dari {filtered.length} invoice
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="border-[#E3E8E4]"
              disabled={currentPage === 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
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
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
