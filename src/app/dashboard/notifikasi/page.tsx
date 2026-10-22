import Link from "next/link";
import { BellOff, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
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
import {
  notificationToneClass,
  notificationTypeLabel,
  notificationVisual,
} from "@/components/dashboard/notification-visuals";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifikasi" };

const filters = [
  { key: "all", label: "Semua" },
  { key: "unread", label: "Belum dibaca" },
];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = filters.some((item) => item.key === params.filter)
    ? params.filter!
    : "all";

  const allRows = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .all();
  const unread = allRows.filter((row) => !row.isRead).length;
  const rows = filter === "unread" ? allRows.filter((row) => !row.isRead) : allRows;

  const description =
    allRows.length === 0
      ? "Belum ada notifikasi untuk akunmu."
      : unread > 0
        ? `${unread} dari ${allRows.length} notifikasi belum dibaca.`
        : `${allRows.length} notifikasi, semuanya sudah dibaca.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifikasi"
        description={description}
        actions={
          allRows.length ? (
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
                confirm="Hapus semua notifikasi? Ini nggak bisa dibatalkan."
              >
                <Trash2 className="size-3.5" /> Hapus semua
              </ActionButton>
            </>
          ) : null
        }
      />

      {allRows.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter notifikasi">
          {filters.map((item) => {
            const count =
              item.key === "all" ? allRows.length : allRows.filter((row) => !row.isRead).length;
            return (
              <Link
                key={item.key}
                href={
                  item.key === "all"
                    ? "/dashboard/notifikasi"
                    : "/dashboard/notifikasi?filter=unread"
                }
                role="tab"
                aria-selected={filter === item.key}
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
                    filter === item.key
                      ? "bg-white/15 text-white"
                      : "bg-[#F1F3F2] text-[#5B6B60]",
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={
            filter === "unread"
              ? "Tidak ada notifikasi belum dibaca"
              : "Belum ada notifikasi"
          }
          description={
            filter === "unread"
              ? "Semua kabar terbaru sudah kamu baca. Notifikasi baru akan muncul di sini."
              : "Kabar status pesanan, pembayaran, dan layanan bakal muncul di sini."
          }
          action={
            filter === "unread" && allRows.length > 0 ? (
              <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
                <Link href="/dashboard/notifikasi">Lihat semua notifikasi</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <SectionCard bodyClassName="p-0">
          <ul className="divide-y divide-[#EDF1EE]">
            {rows.map((item) => {
              const visual = notificationVisual(item.type);
              const Icon = visual.icon;

              return (
                <li
                  key={item.id}
                  className={cn(
                    "relative flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between",
                    !item.isRead ? "bg-[#F8FCF9]" : "bg-white",
                  )}
                >
                  {!item.isRead ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1 bg-[#16A34A]"
                    />
                  ) : null}

                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl",
                        item.isRead
                          ? "bg-[#F1F3F2] text-[#8A9A90]"
                          : notificationToneClass[visual.tone],
                      )}
                    >
                      <Icon className="size-5" />
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[#101613]">{item.title}</p>
                        {!item.isRead ? (
                          <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#166534]">
                            Baru
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#5B6B60]">
                        {item.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#8A9A90]">
                        <span className="rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-[#E3E8E4]">
                          {notificationTypeLabel(item.type)}
                        </span>
                        <span>{formatRelative(item.createdAt)}</span>
                      </div>
                      {item.link ? (
                        <Button
                          asChild
                          variant="link"
                          size="xs"
                          className="mt-2 h-auto px-0 text-[#0B3D2E]"
                        >
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
                        <CheckCheck className="size-3.5" /> Tandai dibaca
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
              );
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
