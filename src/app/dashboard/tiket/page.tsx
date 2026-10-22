import Link from "next/link";
import { ArrowRight, LifeBuoy, Plus } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import {
  formatRelative,
  ticketPriorityLabel,
  ticketStatusLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tiket Support" };

const filters = [
  { key: "all", label: "Semua" },
  { key: "open", label: "Terbuka" },
  { key: "answered", label: "Dibalas" },
  { key: "closed", label: "Ditutup" },
];

const priorityTone: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status } = await searchParams;
  const filter = filters.some((item) => item.key === status) ? status! : "all";
  const all = db
    .select()
    .from(tickets)
    .where(eq(tickets.userId, user.id))
    .orderBy(desc(tickets.updatedAt))
    .all();
  const rows = filter === "all" ? all : all.filter((ticket) => ticket.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tiket support"
        description="Tim support siap bantu masalah teknis, billing, atau pertanyaan lain."
        actions={
          <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Link href="/dashboard/tiket/baru">
              <Plus className="size-4" /> Buka tiket
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => {
          const count =
            item.key === "all"
              ? all.length
              : all.filter((ticket) => ticket.status === item.key).length;
          return (
            <Link
              key={item.key}
              href={item.key === "all" ? "/dashboard/tiket" : `/dashboard/tiket?status=${item.key}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === item.key
                  ? "border-[#0B3D2E] bg-[#0B3D2E] text-white"
                  : "border-[#E3E8E4] bg-white text-[#5B6B60] hover:border-[#BFE3CC] hover:text-[#0B3D2E]",
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold",
                  filter === item.key ? "bg-white/15 text-white" : "bg-[#F1F3F2] text-[#5B6B60]",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={filter === "all" ? "Belum ada tiket" : "Tidak ada tiket dengan status ini"}
          description="Buka tiket kalau ada kendala. Sertakan detail masalahnya biar tim support bisa bantu lebih cepat."
          action={
            <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href="/dashboard/tiket/baru">
                <Plus className="size-4" /> Buka tiket
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <th className="px-4 py-2.5">Tiket</th>
                  <th className="px-4 py-2.5">Departemen</th>
                  <th className="px-4 py-2.5">Prioritas</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Diperbarui</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-[#EDF1EE] last:border-0 hover:bg-[#FBFCFB]">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/tiket/${ticket.id}`} className="font-semibold text-[#101613] hover:text-[#0B3D2E]">
                        {ticket.subject}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-[#8A9A90]">{ticket.ticketNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-[#5B6B60] capitalize">{ticket.department}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={ticket.priority}
                        label={ticketPriorityLabel[ticket.priority]}
                        tone={priorityTone[ticket.priority]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ticket.status} label={ticketStatusLabel[ticket.status]} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6B60]">{formatRelative(ticket.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm" className="text-[#0B3D2E] hover:bg-[#F3F9F5]">
                        <Link href={`/dashboard/tiket/${ticket.id}`}>
                          Buka <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
