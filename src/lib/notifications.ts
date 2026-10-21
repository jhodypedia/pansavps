import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { sendTemplatedEmail } from "@/lib/email";
import { parseEventList, queueWhatsApp } from "@/lib/whatsapp/queue";
import { getSettings } from "@/lib/settings";
import { uid } from "@/lib/format";

export function absoluteUrl(path: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  if (path.startsWith("http")) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}): void {
  db.insert(notifications)
    .values({
      id: uid("ntf_", 16),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      isRead: false,
    })
    .run();
}

export type UserEventInput = {
  userId: string;
  event: string;
  title: string;
  body: string;
  link?: string;
  emailVars?: Record<string, string | number | null | undefined>;
  waPayload?: Record<string, unknown>;
  notifyEmail?: boolean;
  notifyWhatsApp?: boolean;
};

/**
 * Notifikasi user: dashboard selalu dibuat, email & WA sebagai cadangan.
 * Kegagalan email/WA tidak boleh menggagalkan transaksi utama.
 */
export async function notifyUserEvent(input: UserEventInput): Promise<void> {
  createNotification({
    userId: input.userId,
    type: input.event,
    title: input.title,
    body: input.body,
    link: input.link,
  });

  const user = db.select().from(users).where(eq(users.id, input.userId)).get();
  if (!user) return;

  if (input.notifyEmail !== false && user.email) {
    try {
      const emailLink = input.emailVars?.link ?? input.link;
      await sendTemplatedEmail(user.email, input.event, {
        nama: user.name,
        email: user.email,
        ...(input.emailVars ?? {}),
        ...(typeof emailLink === "string" ? { link: absoluteUrl(emailLink) } : {}),
      });
    } catch (error) {
      console.error("[notify] email gagal", error);
    }
  }

  const waEvents = parseEventList(getSettings().wa_user_events);
  if (input.notifyWhatsApp !== false && user.phone && waEvents.includes(input.event)) {
    try {
      const waLink = input.waPayload?.link ?? input.link;
      queueWhatsApp({
        to: user.phone,
        templateKey: input.event,
        payload: {
          nama: user.name,
          brand: getSettings().site_name,
          ...(input.waPayload ?? {}),
          ...(typeof waLink === "string" ? { link: absoluteUrl(waLink) } : {}),
        },
      });
    } catch (error) {
      console.error("[notify] WA queue gagal", error);
    }
  }
}

export async function notifyAdmins(input: {
  type: string;
  title: string;
  body: string;
  link?: string;
  waEvent?: string;
  waMessage?: string;
}) {
  const admins = db.select().from(users).where(eq(users.role, "admin")).all();
  for (const admin of admins) {
    createNotification({
      userId: admin.id,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    });
  }
  if (input.waEvent && input.waMessage) {
    const { queueAdminWhatsApp } = await import("@/lib/whatsapp/queue");
    queueAdminWhatsApp(input.waEvent, input.waMessage);
  }
}
