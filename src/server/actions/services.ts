"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { services, sshKeys } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { performServiceAction, revealRootPassword } from "@/server/services/services";
import { sshFingerprint } from "@/server/services/orders";
import { writeAudit } from "@/lib/audit";
import { uid } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { serviceActionSchema, sshKeySchema } from "@/lib/validators";
import type { ActionResult } from "./types";
import { done, errorMessage, fail, fromZod } from "./utils";

export async function serviceActionAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ password?: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
  const parsed = serviceActionSchema.safeParse({
    serviceId: formData.get("serviceId"),
    action: formData.get("action"),
    image: formData.get("image") || undefined,
    name: formData.get("name") || undefined,
    snapshotId: formData.get("snapshotId") || undefined,
    confirmHostname: formData.get("confirmHostname") || undefined,
  });
  if (!parsed.success) return fromZod(parsed.error);

  const limit = rateLimit(`svc-action:${user.id}`, 20, 5 * 60 * 1000);
  if (!limit.ok) return fail("Terlalu banyak aksi. Tunggu beberapa menit.");

  try {
    const result = await performServiceAction({ ...parsed.data, actor: user });
    revalidatePath(`/dashboard/vps/${parsed.data.serviceId}`);
    revalidatePath("/dashboard/vps");
    revalidatePath("/admin/services");
    revalidatePath(`/admin/services/${parsed.data.serviceId}`);
    return done(result.message, { data: { password: result.password } });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function revealPasswordAction(
  serviceId: string,
  reason?: string,
): Promise<ActionResult<{ password: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const limit = rateLimit(`reveal:${user.id}:${serviceId}`, 5, 10 * 60 * 1000);
  if (!limit.ok) return fail("Terlalu sering membuka kredensial. Coba lagi nanti.");
  try {
    const result = await revealRootPassword({ serviceId, actor: user, reason });
    return done("Kredensial berhasil dibuka. Jangan bagikan ke siapa pun.", {
      data: { password: result.password },
    });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function toggleAutoRenewAction(
  serviceId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const svc = db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.userId, user.id)))
    .get();
  if (!svc) return fail("VPS tidak ditemukan.");
  db.update(services).set({ autoRenew: enabled }).where(eq(services.id, serviceId)).run();
  await writeAudit({
    actor: user,
    action: "toggle_auto_renew",
    entity: "service",
    entityId: serviceId,
    after: { autoRenew: enabled },
  });
  revalidatePath(`/dashboard/vps/${serviceId}`);
  return done(enabled ? "Perpanjangan otomatis diaktifkan." : "Perpanjangan otomatis dimatikan.");
}

export async function addSshKeyAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const parsed = sshKeySchema.safeParse({
    name: formData.get("name"),
    publicKey: formData.get("publicKey"),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const count = db.select().from(sshKeys).where(eq(sshKeys.userId, user.id)).all().length;
  if (count >= 10) return fail("Maksimal 10 SSH key per akun.");
  const dup = db
    .select()
    .from(sshKeys)
    .where(and(eq(sshKeys.userId, user.id), eq(sshKeys.publicKey, parsed.data.publicKey)))
    .get();
  if (dup) return fail("Public key ini sudah tersimpan.");

  const id = uid("ssh_", 16);
  db.insert(sshKeys)
    .values({
      id,
      userId: user.id,
      name: parsed.data.name,
      publicKey: parsed.data.publicKey,
      fingerprint: sshFingerprint(parsed.data.publicKey),
    })
    .run();
  await writeAudit({ actor: user, action: "add_ssh_key", entity: "ssh_key", entityId: id });
  revalidatePath("/dashboard/ssh-keys");
  return done("SSH key berhasil ditambahkan.");
}

export async function deleteSshKeyAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const key = db
    .select()
    .from(sshKeys)
    .where(and(eq(sshKeys.id, id), eq(sshKeys.userId, user.id)))
    .get();
  if (!key) return fail("SSH key tidak ditemukan.");
  const used = db
    .select()
    .from(services)
    .where(and(eq(services.sshKeyId, id), eq(services.status, "active")))
    .get();
  if (used) return fail("SSH key masih dipakai VPS aktif dan tidak bisa dihapus.");
  db.delete(sshKeys).where(eq(sshKeys.id, id)).run();
  await writeAudit({ actor: user, action: "delete_ssh_key", entity: "ssh_key", entityId: id });
  revalidatePath("/dashboard/ssh-keys");
  return done("SSH key dihapus.");
}
