import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LifeBuoy, MessageSquare, ShieldCheck } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ticketReplies, tickets, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import {
  formatDateTime,
  formatRelative,
  ticketPriorityLabel,
  ticketStatusLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { InfoRow, SectionCard } from "@/components/dashboard/section-card";
import { TicketReplyForm } from "@/components/dashboard/ticket-forms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail Tiket" };

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = db.select().from(tickets).where(eq(tickets.id, id)).get();
  if (!ticket || (ticket.userId !== user.id && user.role !== "admin")) notFound();

  const replies = db
    .select()
    .from(ticketReplies)
    .where(eq(ticketReplies.ticketId, ticket.id))
    .orderBy(asc(ticketReplies.createdAt))
    .all();
  const authorIds = [...new Set(replies.map((reply) => reply.userId).filter(Boolean))] as string[];
  const authors = authorIds.length
    ? db.select().from(users).all().filter((row) => authorIds.includes(row.id))
    : [];
  const authorMap = new Map(authors.map((author) => [author.id, author]));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tiket", href: "/dashboard/tiket" },
          { label: ticket.ticketNumber },
        ]}
        title={ticket.subject}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} label={ticketStatusLabel[ticket.status]} />
            <StatusBadge status={ticket.priority} label={ticketPriorityLabel[ticket.priority]} />
            <span>
              {ticket.ticketNumber} · diperbarui {formatRelative(ticket.updatedAt)}
            </span>
          </span>
        }
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/dashboard/tiket">
              <ArrowLeft className="size-4" /> Semua tiket
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Percakapan" bodyClassName="p-0">
            <ul className="divide-y divide-[#EDF1EE]">
              {replies.map((reply) => {
                const author = reply.userId ? authorMap.get(reply.userId) : null;
                const isAdmin = reply.authorRole === "admin";
                return (
                  <li key={reply.id} className={cn("px-5 py-4", isAdmin && "bg-[#FBFCFB]")}>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full text-xs font-bold",
                          isAdmin ? "bg-[#0B3D2E] text-white" : "bg-[#E7F4EC] text-[#0B3D2E]",
                        )}
                      >
                        {isAdmin ? <ShieldCheck className="size-4" /> : (author?.name?.[0] ?? "U")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#101613]">
                          {isAdmin ? "Tim Support" : author?.name ?? "Kamu"}
                          {isAdmin ? (
                            <span className="ml-2 rounded-full bg-[#E7F4EC] px-2 py-0.5 text-[10px] font-bold text-[#0B3D2E]">
                              ADMIN
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-[#8A9A90]">{formatDateTime(reply.createdAt)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-[#3B4A41]">
                      {reply.body}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-[#E3E8E4] p-5">
              <TicketReplyForm ticketId={ticket.id} closed={ticket.status === "closed"} />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Informasi tiket">
            <dl className="divide-y divide-[#EDF1EE]">
              <InfoRow label="Nomor" value={<span className="font-mono text-xs">{ticket.ticketNumber}</span>} />
              <InfoRow label="Departemen" value={<span className="capitalize">{ticket.department}</span>} />
              <InfoRow label="Prioritas" value={ticketPriorityLabel[ticket.priority]} />
              <InfoRow label="Status" value={ticketStatusLabel[ticket.status]} />
              <InfoRow label="Dibuat" value={formatDateTime(ticket.createdAt)} />
              <InfoRow label="Diperbarui" value={formatDateTime(ticket.updatedAt)} />
            </dl>
          </SectionCard>
          <div className="rounded-2xl border border-[#BFE3CC] bg-[#F3F9F5] p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-[#0B3D2E]">
              <MessageSquare className="size-4" /> Tips
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#5B6B60]">
              Balasan baru akan mengirim notifikasi email dan WhatsApp. Kamu bisa menutup tiket
              kapan saja jika masalah sudah selesai.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E3E8E4] bg-white p-5 text-center">
            <LifeBuoy className="mx-auto size-6 text-[#8A9A90]" />
            <p className="mt-2 text-sm font-semibold text-[#101613]">Masalah lain?</p>
            <p className="mt-1 text-xs text-[#5B6B60]">Buka tiket baru agar tidak tercampur.</p>
            <Button asChild variant="outline" size="sm" className="mt-3 border-[#D8E2DB] bg-white">
              <Link href="/dashboard/tiket/baru">Buka tiket baru</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
