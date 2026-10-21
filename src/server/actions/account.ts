"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auditLogs, notifications, users } from "@/lib/db/schema";
import {
  destroyOtherSessions,
  getSessionUser,
  hashPassword,
  verifyPassword,
  currentSessionToken,
} from "@/lib/auth";
import { changePasswordSchema, profileSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./types";
import { done, errorMessage, fail, fromZod } from "./utils";

export async function updateProfileAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || "",
  });
  if (!parsed.success) return fromZod(parsed.error);

  const before = { name: user.name, phone: user.phone };
  const nextPhone = parsed.data.phone || null;
  const phoneChanged = (user.phone ?? null) !== nextPhone;
  db.update(users)
    .set({
      name: parsed.data.name,
      phone: nextPhone,
      ...(phoneChanged ? { phoneVerifiedAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .run();
  await writeAudit({
    actor: user,
    action: "update_profile",
    entity: "user",
    entityId: user.id,
    before,
    after: { name: parsed.data.name, phone: parsed.data.phone || null },
  });
  revalidatePath("/dashboard/pengaturan");
  revalidatePath("/dashboard");
  return done("Profil berhasil diperbarui.");
}

export async function changePasswordAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const limit = rateLimit(`password:${user.id}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return fail("Terlalu banyak percobaan. Coba lagi nanti.");

  const row = db.select().from(users).where(eq(users.id, user.id)).get();
  if (!row) return fail("Akun tidak ditemukan.");
  const valid = await verifyPassword(parsed.data.currentPassword, row.passwordHash);
  if (!valid) {
    return fail("Password lama tidak sesuai.", { currentPassword: ["Password lama tidak sesuai."] });
  }
  const sameAsOld = await verifyPassword(parsed.data.newPassword, row.passwordHash);
  if (sameAsOld) return fail("Password baru harus berbeda dari password lama.");

  const passwordHash = await hashPassword(parsed.data.newPassword);
  db.update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .run();
  const token = await currentSessionToken();
  await destroyOtherSessions(user.id, token ?? undefined);
  await writeAudit({ actor: user, action: "change_password", entity: "user", entityId: user.id });
  return done("Password berhasil diubah. Sesi lain sudah dikeluarkan.");
}

export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
  const token = await currentSessionToken();
  await destroyOtherSessions(user.id, token ?? undefined);
  await writeAudit({ actor: user, action: "revoke_sessions", entity: "user", entityId: user.id });
  revalidatePath("/dashboard/pengaturan");
  return done("Semua sesi lain berhasil dikeluarkan.");
}

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .run();
  revalidatePath("/dashboard/notifikasi");
  revalidatePath("/dashboard");
  return done("Notifikasi ditandai dibaca.");
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
    .run();
  revalidatePath("/dashboard/notifikasi");
  revalidatePath("/dashboard");
  return done("Semua notifikasi ditandai dibaca.");
}

export async function deleteNotificationAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  db.delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .run();
  revalidatePath("/dashboard/notifikasi");
  return done("Notifikasi dihapus.");
}

export async function clearNotificationsAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  db.delete(notifications).where(eq(notifications.userId, user.id)).run();
  revalidatePath("/dashboard/notifikasi");
  return done("Semua notifikasi dihapus.");
}

export async function exportAccountDataAction(): Promise<ActionResult<{ audit: unknown[] }>> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  try {
    const rows = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actorId, user.id))
      .all()
      .slice(-100);
    return done("Data audit akun dimuat.", { data: { audit: rows } });
  } catch (error) {
    return fail(errorMessage(error));
  }
}
