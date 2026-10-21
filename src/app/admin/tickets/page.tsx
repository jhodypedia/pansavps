import Link from "next/link";
import { desc } from "drizzle-orm";
import { Clock, LifeBuoy, MessageSquare, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { tickets, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  formatDateTime,
  formatRelative,
  ticketPriorityLabel,
  ticketStatusLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tiket Support" };

const filters = [
  { key: "all", label: "Semua" },
  { key: "open", label: "Terbuka" },
  { key: "answered", label: "Dibalas" },
  { key: "closed", label: "Ditutup" },
];

const priorityTone: Record<string, string> = {
  low: "bg-[#F1F3F2] text-[#5B6B60]",
  normal: "bg-[#EFF6FF] text-[#1E40AF]",
  high: "bg-[#FEF3C7] text-[#92400E]",
  urgent: "bg-[#FEE2E2] text-[#991B1B]",
};

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const filter = filters.some((item) => item.key === status) ? status! : "all";
  const search = (q ?? "").trim().toLowerCase();

  const all = db.select().from(tickets).orderBy(desc(tickets.updatedAt)).all();
  const userRows = db.select().from(users).all();
  const userMap = new Map(userRows.map((user) => [user.id, user]));

  const rows = all.filter((ticket) => {
    if (filter !== "all" && ticket.status !== filter) return false;
    if (!search) return true;
    const owner = userMap.get(ticket.userId);
    return [ticket.ticketNumber, ticket.subject, owner?.name, owner?.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tiket support"
        description="Balas pertanyaan pelanggan dan atur prioritas penanganan."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Semua tiket", value: all.length, hint: "Seluruh riwayat", icon: LifeBuoy },
          { label: "Terbuka", value: all.filter((ticket) => ticket.status === "open").length, hint: "Menunggu balasan", icon: MessageSquare },
          { label: "Mendesak", value: all.filter((ticket) => ticket.priority === "urgent" && ticket.status !== "closed").length, hint: "Prioritas tertinggi", icon: ShieldAlert },
          { label: "Ditutup", value: all.filter((ticket) => ticket.status === "closed").length, hint: "Selesai ditangani", icon: Clock },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">{item.label}</p>
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                <item.icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-[#101613]">{item.value}</p>
            <p className="mt-0.5 text-xs text-[#8A9A90]">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => {
            const count = item.key === "all" ? all.length : all.filter((ticket) => ticket.status === item.key).length;
            return (
              <Link
                key={item.key}
                href={item.key === "all" ? "/admin/tickets" : `/admin/tickets?status=${item.key}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === item.key
                    ? "border-[#0B3D2E] bg-[#0B3D2E] text-white"
                    : "border-[#E3E8E4] bg-white text-[#5B6B60] hover:border-[#BFE3CC] hover:text-[#0B3D2E]",
                )}
              >
                {item.label}
                <span className={cn("rounded-full px-1.5 text-[10px]", filter === item.key ? "bg-white/15" : "bg-[#F1F3F2]")}>
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
        <form className="flex gap-2" action="/admin/tickets">
          {filter !== "all" ? <input type="hidden" name="status" value={filter} /> : null}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari nomor, subjek, pengguna…"
            className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm sm:w-64"
          />
          <Button type="submit" variant="outline" className="border-[#D8E2DB] bg-white">
            Cari
          </Button>
        </form>
      </div>

      <SectionCard bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={LifeBuoy} title="Tidak ada tiket" description="Tiket dari pelanggan akan muncul di sini." />
          </div>
        ) : (
          <ul className="divide-y divide-[#EDF1EE]">
            {rows.map((ticket) => {
              const owner = userMap.get(ticket.userId);
              return (
                <li key={ticket.id}>
                  <Link href={`/admin/tickets/${ticket.id}`} className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-[#F9FBFA] sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#101613]">{ticket.subject}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", priorityTone[ticket.priority])}>
                          {ticketPriorityLabel[ticket.priority]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#8A9A90]">
                        <span className="font-mono">{ticket.ticketNumber}</span> · {owner?.name ?? "—"} ·{" "}
                        {owner?.email ?? ""} · {formatDateTime(ticket.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-[#8A9A90]">Diperbarui {formatRelative(ticket.updatedAt)}</span>
                      <StatusBadge status={ticket.status} label={ticketStatusLabel[ticket.status]} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
