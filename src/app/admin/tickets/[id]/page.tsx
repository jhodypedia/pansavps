import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { services, ticketReplies, tickets, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  formatDateTime,
  formatRelative,
  serviceStatusLabel,
  ticketPriorityLabel,
  ticketStatusLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { InfoRow, SectionCard } from "@/components/dashboard/section-card";
import { TicketReplyForm } from "@/components/dashboard/ticket-forms";
import { AdminTicketMetaForm } from "@/components/dashboard/admin-ticket-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail Tiket" };

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const ticket = db.select().from(tickets).where(eq(tickets.id, id)).get();
  if (!ticket) notFound();

  const owner = db.select().from(users).where(eq(users.id, ticket.userId)).get();
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
  const ownerServices = db
    .select()
    .from(services)
    .where(eq(services.userId, ticket.userId))
    .all()
    .filter((service) => service.status !== "terminated")
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Tiket", href: "/admin/tickets" },
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
            <Link href="/admin/tickets">
              <ArrowLeft className="size-4" /> Semua tiket
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <SectionCard title="Percakapan" description="Balasan admin mengirim notifikasi ke pelanggan." bodyClassName="p-0">
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
                        {isAdmin ? "Tim Support" : author?.name ?? "Pelanggan"}
                        {isAdmin ? (
                          <span className="ml-2 rounded-full bg-[#E7F4EC] px-2 py-0.5 text-[10px] font-bold text-[#0B3D2E]">ADMIN</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-[#8A9A90]">{formatDateTime(reply.createdAt)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-[#3B4A41]">{reply.body}</p>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[#E3E8E4] p-5">
            <TicketReplyForm ticketId={ticket.id} closed={ticket.status === "closed"} />
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Pelanggan" bodyClassName="p-0">
            <dl className="divide-y divide-[#EDF1EE] px-5">
              <InfoRow label="Nama" value={owner?.name ?? "—"} />
              <InfoRow label="Email" value={owner?.email ?? "—"} />
              <InfoRow label="WhatsApp" value={owner?.phone ?? "—"} />
              <InfoRow label="Status akun" value={owner?.status === "active" ? "Aktif" : "Ditangguhkan"} />
            </dl>
            {owner ? (
              <div className="border-t border-[#EDF1EE] p-4">
                <Button asChild variant="outline" size="sm" className="w-full border-[#D8E2DB] bg-white">
                  <Link href={`/admin/users/${owner.id}`}>
                    <ExternalLink className="size-3.5" /> Buka profil pengguna
                  </Link>
                </Button>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Layanan terkait" bodyClassName="p-0">
            {ownerServices.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-[#5B6B60]">Tidak ada layanan aktif.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {ownerServices.map((service) => (
                  <li key={service.id} className="flex items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <Link href={`/admin/services/${service.id}`} className="text-sm font-semibold text-[#101613] hover:text-[#0B3D2E] hover:underline">
                        {service.hostname}
                      </Link>
                      <p className="text-xs text-[#8A9A90]">
                        {service.regionSlug} · {service.ipv4 ?? "—"}
                      </p>
                    </div>
                    <StatusBadge status={service.status} label={serviceStatusLabel[service.status]} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Pengaturan tiket" description="Hanya terlihat oleh admin.">
            <AdminTicketMetaForm
              ticketId={ticket.id}
              status={ticket.status}
              priority={ticket.priority}
              internalNote={ticket.internalNote}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
