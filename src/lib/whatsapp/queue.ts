import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/core";
import { users, waOutbox, waState, waTemplates } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { encrypt } from "@/lib/crypto";
import { isValidPhone, normalizePhone, uid } from "@/lib/format";
import { DEFAULT_WA_TEMPLATES } from "./templates";

export function isWhatsAppConnected(): boolean {
  if (getSettings().wa_enabled !== "true") return false;
  const state = db.select().from(waState).where(eq(waState.id, "singleton")).get();
  return state?.status === "connected";
}

export function parseEventList(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export function adminNumbers(): string[] {
  const s = getSettings();
  return (s.wa_notify_admin_numbers || "")
    .split(/[,\n;]/)
    .map((n) => normalizePhone(n))
    .filter((n) => isValidPhone(n));
}

/**
 * Hanya memasukkan pesan ke outbox. Pengiriman dilakukan worker WA.
 * Password untuk template provisioning_done disimpan terenkripsi.
 */
export function queueWhatsApp(input: {
  to: string;
  templateKey: string;
  payload: Record<string, unknown>;
  priority?: number;
  scheduledAt?: Date;
}): string | null {
  const s = getSettings();
  if (s.wa_enabled !== "true") return null;
  const to = normalizePhone(input.to);
  if (!isValidPhone(to)) return null;

  if (input.templateKey !== "custom" && input.templateKey !== "test" && input.templateKey !== "admin_custom") {
    const template = db
      .select()
      .from(waTemplates)
      .where(eq(waTemplates.key, input.templateKey))
      .get();
    if (template && !template.isActive) return null;
    if (!template && !DEFAULT_WA_TEMPLATES[input.templateKey]) return null;
  }

  const payload: Record<string, unknown> = { ...input.payload };
  if (input.templateKey === "provisioning_done" && typeof payload.password === "string") {
    payload.password_enc = encrypt(payload.password);
    delete payload.password;
  }

  const id = uid("wa_", 16);
  db.insert(waOutbox)
    .values({
      id,
      toNumber: to,
      templateKey: input.templateKey,
      payload,
      status: "queued",
      priority: input.priority ?? 0,
      scheduledAt: input.scheduledAt ?? new Date(),
      updatedAt: new Date(),
    })
    .run();
  return id;
}

export function queueAdminWhatsApp(
  event: string,
  message: string,
  payload: Record<string, unknown> = {},
) {
  const s = getSettings();
  const allowed = parseEventList(s.wa_admin_events);
  if (!allowed.includes(event) && event !== "test") return [];
  return adminNumbers().map((number) =>
    queueWhatsApp({
      to: number,
      templateKey: "admin_custom",
      payload: { ...payload, message },
      priority: 5,
    }),
  );
}

export async function notifyAdminWhatsApp(event: string, message: string) {
  queueAdminWhatsApp(event, message);
}

export function waStats() {
  const rows = db.select().from(waOutbox).all();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    sentToday: rows.filter((r) => r.status === "sent" && r.sentAt && r.sentAt >= today).length,
    queued: rows.filter((r) => r.status === "queued").length,
    failed: rows.filter((r) => r.status === "failed").length,
    sending: rows.filter((r) => r.status === "sending").length,
  };
}

export function retryWaMessages(ids: string[]) {
  if (!ids.length) return;
  db.update(waOutbox)
    .set({ status: "queued", attempts: 0, lastError: null, scheduledAt: new Date(), updatedAt: new Date() })
    .where(and(inArray(waOutbox.id, ids), inArray(waOutbox.status, ["failed"])))
    .run();
}

export function userPhone(userId: string): string | null {
  const user = db.select({ phone: users.phone }).from(users).where(eq(users.id, userId)).get();
  return user?.phone ?? null;
}
