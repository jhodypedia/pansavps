"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  Bell,
  BellOff,
  CheckCheck,
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
          className="relative flex size-9 items-center justify-center rounded-lg text-[#5B6B60] transition-colors hover:bg-[#F3F9F5] hover:text-[#0B3D2E] focus-visible:ring-2 focus-visible:ring-[#BFE3CC] focus-visible:outline-none"
          aria-label={
            unread > 0
              ? `Notifikasi, ${unread} belum dibaca`
              : "Notifikasi"
          }
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#16A34A] px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {unreadLabel}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[calc(100vw-2rem)] max-w-[390px] overflow-hidden rounded-2xl border-[#E3E8E4] bg-white p-0 shadow-[0_24px_60px_-24px_rgba(11,61,46,0.38)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EDF1EE] px-4 py-3.5">
          <div>
            <p className="font-display text-sm font-bold text-[#101613]">
              Notifikasi
            </p>
            <p className="mt-0.5 text-xs text-[#8A9A90]">
              {unread > 0
                ? `${unread} belum dibaca`
                : "Semua notifikasi sudah dibaca"}
            </p>
          </div>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#0B3D2E] transition-colors hover:bg-[#F3F9F5] disabled:cursor-not-allowed disabled:opacity-60"
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

        {items.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#F3F9F5] text-[#0B3D2E]">
              <BellOff className="size-5" />
            </span>
            <p className="mt-3 text-sm font-bold text-[#101613]">
              Belum ada notifikasi
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#8A9A90]">
              Kabar pesanan, pembayaran, dan layananmu akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            {items.map((item) => {
              const read = item.isRead;
              const visual = notificationVisual(item.type);
              const Icon = visual.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-[#F0F3F1] px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-[#FBFCFB]",
                    !read && "bg-[#F8FCF9] hover:bg-[#F3F9F5]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                      read
                        ? "bg-[#F1F3F2] text-[#8A9A90]"
                        : notificationToneClass[visual.tone],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "line-clamp-1 text-sm text-[#101613]",
                          read ? "font-semibold" : "font-bold",
                        )}
                      >
                        {item.title}
                      </span>
                      {!read ? (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#16A34A]" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#5B6B60]">
                      {item.body}
                    </span>
                    <span className="mt-1 block text-[11px] text-[#8A9A90]">
                      {formatRelative(item.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="border-t border-[#EDF1EE] bg-[#FBFCFB] p-2">
          <Link
            href={allHref}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-[#0B3D2E] transition-colors hover:bg-white"
          >
            Lihat semua notifikasi
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
