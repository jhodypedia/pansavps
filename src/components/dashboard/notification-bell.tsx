"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Inbox,
  Loader2,
} from "lucide-react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/account";
import { formatRelative } from "@/lib/format";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  notificationToneClass,
  notificationTypeLabel,
  notificationVisual,
} from "@/components/dashboard/notification-visuals";

export type NotificationPreview = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell({
  items,
  unread,
  allHref = "/dashboard/notifikasi",
}: {
  items: NotificationPreview[];
  unread: number;
  allHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function openNotification(item: NotificationPreview) {
    setOpen(false);
    startTransition(async () => {
      if (!item.isRead) {
        try {
          const result = await markNotificationReadAction(item.id);
          if (!result.ok) toastError(result.message);
        } catch {
          toastError("Gagal menandai notifikasi sebagai dibaca.");
        }
      }
      if (item.link) router.push(item.link);
      router.refresh();
    });
  }

  function markAllRead() {
    startTransition(async () => {
      try {
        const result = await markAllNotificationsReadAction();
        if (result.ok) {
          router.refresh();
        } else {
          toastError(result.message);
        }
      } catch {
        toastError("Gagal menandai semua notifikasi.");
      }
    });
  }

  const unreadLabel = unread > 99 ? "99+" : String(unread);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "notif-bell-trigger group relative inline-flex size-10 items-center justify-center rounded-xl border text-[#5B6B60] transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#BFE3CC] focus-visible:outline-none",
            unread > 0
              ? "border-[#CFE6D8] bg-[#FBFEFC] text-[#0B3D2E] shadow-[0_6px_18px_-14px_rgba(11,61,46,0.55)]"
              : "border-[#E3E8E4] bg-white",
            "hover:-translate-y-0.5 hover:border-[#BFE3CC] hover:bg-white hover:text-[#0B3D2E] hover:shadow-[0_10px_24px_-16px_rgba(11,61,46,0.5)] active:translate-y-0 active:scale-[0.97]",
            open && "border-[#BFE3CC] bg-white shadow-[0_10px_24px_-16px_rgba(11,61,46,0.5)]",
          )}
          aria-label={
            unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"
          }
          title="Notifikasi"
        >
          <span className="relative flex size-6 items-center justify-center">
            <Bell
              className={cn(
                "notif-bell-icon size-[19px] transition-transform duration-300",
                open && "-rotate-6",
              )}
            />
            {unread > 0 ? (
              <span
                key={unread}
                className="notif-badge absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#16A34A] px-1 text-[9px] font-extrabold text-white shadow-[0_4px_10px_rgba(22,163,74,0.38)] ring-2 ring-white"
                aria-hidden
              >
                {unreadLabel}
              </span>
            ) : null}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        sideOffset={12}
        collisionPadding={12}
        className="notif-pop w-[calc(100vw-2rem)] max-w-[400px] overflow-hidden rounded-[22px] border-[#DCE9E1] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(6,35,26,0.5)]"
      >
        <div className="relative overflow-hidden bg-[#0B3D2E] px-4 pt-4 pb-4 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,226,176,0.24),transparent_58%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -right-9 size-32 rounded-full border border-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-7 -right-4 size-20 rounded-full border border-white/10"
          />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex size-10 items-center justify-center rounded-2xl bg-white/10 text-[#DDF3E5] ring-1 ring-white/10">
                <Bell className="size-5" />
                {unread > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#7DE2B0] ring-2 ring-[#0B3D2E]" />
                ) : null}
              </span>
              <div>
                <p className="font-display text-[15px] font-bold">Notifikasi</p>
                <p className="mt-0.5 text-[11px] text-white/55">
                  {unread > 0
                    ? `${unread} belum dibaca`
                    : "Semua notifikasi sudah dibaca"}
                </p>
              </div>
            </div>

            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                disabled={pending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-bold text-white/85 ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="size-3.5" />
                )}
                Tandai semua
              </button>
            ) : null}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-[#F3F9F5] text-[#0B3D2E]">
              <span className="absolute inset-0 rounded-full border border-[#BFE3CC]/70" />
              <span className="absolute inset-2 rounded-full border border-dashed border-[#CFE6D8]" />
              <BellOff className="notif-empty-icon size-6" />
            </span>
            <p className="mt-4 text-sm font-bold text-[#101613]">
              Belum ada notifikasi
            </p>
            <p className="mx-auto mt-1 max-w-[240px] text-xs leading-relaxed text-[#8A9A90]">
              Kabar pesanan, pembayaran, dan layananmu akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="max-h-[min(430px,62vh)] overflow-y-auto bg-[#FBFCFB] p-2">
            {items.map((item, index) => {
              const read = item.isRead;
              const visual = notificationVisual(item.type);
              const Icon = visual.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  style={{ animationDelay: `${index * 45}ms` }}
                  className={cn(
                    "notif-item-in group relative my-1 flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 first:mt-0 last:mb-0",
                    read
                      ? "border-transparent bg-transparent hover:border-[#E3E8E4] hover:bg-white"
                      : "border-[#DCEFE3] bg-white shadow-[0_8px_24px_-20px_rgba(11,61,46,0.5)] hover:border-[#BFE3CC] hover:shadow-[0_14px_30px_-20px_rgba(11,61,46,0.55)]",
                  )}
                >
                  {!read ? (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-0 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[#16A34A]"
                    />
                  ) : null}

                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
                      read
                        ? "bg-[#F1F3F2] text-[#8A9A90]"
                        : notificationToneClass[visual.tone],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span
                        className={cn(
                          "line-clamp-1 text-[13px] text-[#101613]",
                          read ? "font-semibold" : "font-bold",
                        )}
                      >
                        {item.title}
                      </span>
                      {!read ? (
                        <span className="ml-auto shrink-0 rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[9px] font-bold text-[#166534]">
                          Baru
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[#5B6B60]">
                      {item.body}
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#8A9A90]">
                      <span className="font-semibold text-[#0B3D2E]">
                        {notificationTypeLabel(item.type)}
                      </span>
                      <span className="size-1 rounded-full bg-[#D8E2DB]" />
                      <span>{formatRelative(item.createdAt)}</span>
                    </span>
                  </span>

                  <ChevronRight className="mt-2 size-3.5 shrink-0 text-[#B6C4BB] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        )}

        <div className="border-t border-[#EDF1EE] bg-white p-2">
          <Link
            href={allHref}
            onClick={() => setOpen(false)}
            className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold text-[#0B3D2E] transition-colors duration-200 hover:bg-[#F3F9F5]"
          >
            <span className="inline-flex items-center gap-2">
              <Inbox className="size-3.5" />
              Lihat semua notifikasi
            </span>
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
