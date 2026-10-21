import Link from "next/link";
import { Bell, BellOff, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import {
  clearNotificationsAction,
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/account";
import { formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/dashboard/section-card";
import { ActionButton } from "@/components/dashboard/action-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifikasi" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .all();
  const unread = rows.filter((row) => !row.isRead).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifikasi"
        description={unread ? `${unread} notifikasi belum dibaca.` : "Semua notifikasi sudah dibaca."}
        actions={
          rows.length ? (
            <>
              <ActionButton
                action={markAllNotificationsReadAction}
                disabled={unread === 0}
                variant="outline"
                className="border-[#D8E2DB] bg-white"
              >
                <CheckCheck className="size-3.5" /> Tandai semua dibaca
              </ActionButton>
              <ActionButton
                action={clearNotificationsAction}
                variant="outline"
                className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]"
                confirm="Hapus semua notifikasi? Tindakan ini tidak dapat dibatalkan."
              >
                <Trash2 className="size-3.5" /> Hapus semua
              </ActionButton>
            </>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Belum ada notifikasi"
          description="Pemberitahuan status pesanan, pembayaran, dan layanan akan muncul di sini."
        />
      ) : (
        <SectionCard bodyClassName="p-0">
          <ul className="divide-y divide-[#EDF1EE]">
            {rows.map((item) => (
              <li
                key={item.id}
                className={cn("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between", !item.isRead && "bg-[#F3F9F5]")}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                      item.isRead ? "bg-[#F1F3F2] text-[#8A9A90]" : "bg-[#E7F4EC] text-[#0B3D2E]",
                    )}
                  >
                    <Bell className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold text-[#101613]">
                      {item.title}
                      {!item.isRead ? <span className="size-1.5 rounded-full bg-[#16A34A]" /> : null}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-[#5B6B60]">{item.body}</p>
                    <p className="mt-1 text-xs text-[#8A9A90]">{formatRelative(item.createdAt)}</p>
                    {item.link ? (
                      <Button asChild variant="link" size="xs" className="mt-1 h-auto px-0 text-[#0B3D2E]">
                        <Link href={item.link}>
                          Lihat detail <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 self-end sm:self-start">
                  {!item.isRead ? (
                    <ActionButton
                      action={markNotificationReadAction.bind(null, item.id)}
                      variant="ghost"
                      className="text-[#0B3D2E] hover:bg-[#E7F4EC]"
                      size="xs"
                    >
                      <CheckCheck className="size-3.5" /> Tandai
                    </ActionButton>
                  ) : null}
                  <ActionButton
                    action={deleteNotificationAction.bind(null, item.id)}
                    variant="ghost"
                    className="text-[#8A9A90] hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
                    size="xs"
                  >
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
