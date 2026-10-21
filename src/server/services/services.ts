import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  plans,
  serviceActionsLog,
  services,
  snapshots,
} from "@/lib/db/schema";
import {
  deleteDroplet,
  deleteSnapshot,
  dropletAction,
  getDroplet,
  rebuildDroplet,
  renameDroplet,
  resizeDroplet,
  snapshotDroplet,
} from "@/lib/digitalocean";
import { decrypt, encrypt, randomPassword } from "@/lib/crypto";
import { uid } from "@/lib/format";
import { writeAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";

export class ServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function getServiceForUser(serviceId: string, userId: string) {
  return db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.userId, userId)))
    .get();
}

export function getServiceById(serviceId: string) {
  return db.select().from(services).where(eq(services.id, serviceId)).get();
}

export function getServiceWithPlan(serviceId: string) {
  const service = getServiceById(serviceId);
  if (!service) return null;
  const plan = db.select().from(plans).where(eq(plans.id, service.planId)).get();
  return { service, plan };
}

export function listUserServices(userId: string) {
  return db
    .select()
    .from(services)
    .where(eq(services.userId, userId))
    .orderBy(desc(services.createdAt))
    .all();
}

export function listSnapshots(serviceId: string) {
  return db
    .select()
    .from(snapshots)
    .where(eq(snapshots.serviceId, serviceId))
    .orderBy(desc(snapshots.createdAt))
    .all();
}

function logAction(input: {
  serviceId: string;
  actor: "user" | "admin" | "system";
  actorId?: string | null;
  action: string;
  message: string;
  status?: "success" | "failed";
  payload?: Record<string, unknown>;
}) {
  db.insert(serviceActionsLog)
    .values({
      id: uid("sal_", 16),
      serviceId: input.serviceId,
      actor: input.actor,
      actorId: input.actorId ?? null,
      action: input.action,
      payload: input.payload ?? null,
      resultStatus: input.status ?? "success",
      message: input.message,
    })
    .run();
}

function normalizeError(error: unknown): string {
  if (error instanceof ServiceError) return error.message;
  const msg = error instanceof Error ? error.message : "Aksi gagal.";
  return msg.length > 180 ? "Aksi gagal diproses. Coba lagi." : msg;
}

export async function performServiceAction(input: {
  serviceId: string;
  action: string;
  actor: SessionUser;
  image?: string;
  name?: string;
  snapshotId?: string;
  confirmHostname?: string;
}): Promise<{ message: string; password?: string }> {
  const service = getServiceById(input.serviceId);
  if (!service) throw new ServiceError("NOT_FOUND", "VPS tidak ditemukan.");
  const isAdmin = input.actor.role === "admin";
  if (service.userId !== input.actor.id && !isAdmin) {
    throw new ServiceError("FORBIDDEN", "VPS ini bukan milik kamu.");
  }

  if (input.action === "terminate" || input.action === "rebuild") {
    if (input.confirmHostname !== service.hostname) {
      throw new ServiceError("CONFIRM", "Ketik hostname dengan benar untuk melanjutkan.");
    }
  }

  if (!service.doDropletId && !["terminate", "sync"].includes(input.action)) {
    throw new ServiceError("NO_DROPLET", "Droplet belum tersedia.");
  }

  const dropletId = service.doDropletId ?? "";
  const accountId = service.doAccountId;
  let message = "Aksi berhasil dijalankan.";
  let password: string | undefined;

  try {
    switch (input.action) {
      case "power_on":
        await dropletAction(dropletId, "power_on", {}, accountId);
        if (service.status === "suspended") {
          db.update(services).set({ status: "active" }).where(eq(services.id, service.id)).run();
        }
        message = "Server dinyalakan.";
        break;
      case "power_off":
        await dropletAction(dropletId, "power_off", {}, accountId);
        message = "Server dimatikan paksa.";
        break;
      case "shutdown":
        await dropletAction(dropletId, "shutdown", {}, accountId);
        message = "Perintah shutdown dikirim. Server akan berhenti dengan rapi.";
        break;
      case "reboot":
        await dropletAction(dropletId, "reboot", {}, accountId);
        message = "Server sedang di-reboot.";
        break;
      case "power_cycle":
        await dropletAction(dropletId, "power_cycle", {}, accountId);
        message = "Power cycle dijalankan.";
        break;
      case "password_reset": {
        await dropletAction(dropletId, "password_reset", {}, accountId);
        password = randomPassword(20);
        db.update(services)
          .set({ rootPasswordEncrypted: encrypt(password) })
          .where(eq(services.id, service.id))
          .run();
        message = "Password root baru sudah dibuat. Lihat di tab Akses.";
        break;
      }
      case "rebuild": {
        if (!input.image) throw new ServiceError("IMAGE_REQUIRED", "Pilih sistem operasi untuk rebuild.");
        await rebuildDroplet(dropletId, input.image, accountId);
        db.update(services).set({ osSlug: input.image }).where(eq(services.id, service.id)).run();
        message = "Rebuild dimulai. Semua data lama akan hilang.";
        break;
      }
      case "snapshot": {
        const name = input.name?.trim() || `snap-${service.hostname}-${Date.now()}`;
        await snapshotDroplet(dropletId, name, accountId);
        db.insert(snapshots)
          .values({
            id: uid("snap_", 16),
            serviceId: service.id,
            doSnapshotId: `mock-${uid("", 10)}`,
            name,
          })
          .run();
        message = "Snapshot sedang dibuat.";
        break;
      }
      case "delete_snapshot": {
        if (!input.snapshotId) throw new ServiceError("SNAPSHOT_REQUIRED", "Snapshot tidak dipilih.");
        const snapshot = db
          .select()
          .from(snapshots)
          .where(and(eq(snapshots.id, input.snapshotId), eq(snapshots.serviceId, service.id)))
          .get();
        if (!snapshot) throw new ServiceError("NOT_FOUND", "Snapshot tidak ditemukan.");
        await deleteSnapshot(snapshot.doSnapshotId, accountId);
        db.delete(snapshots).where(eq(snapshots.id, snapshot.id)).run();
        message = "Snapshot dihapus.";
        break;
      }
      case "enable_ipv6":
        await dropletAction(dropletId, "enable_ipv6", {}, accountId);
        message = "IPv6 diaktifkan. Alamat akan muncul setelah sinkronisasi.";
        break;
      case "enable_backups":
        await dropletAction(dropletId, "enable_backups", {}, accountId);
        message = "Backup otomatis diaktifkan.";
        break;
      case "disable_backups":
        await dropletAction(dropletId, "disable_backups", {}, accountId);
        message = "Backup otomatis dimatikan.";
        break;
      case "rename": {
        const newName = input.name?.trim().toLowerCase();
        if (!newName || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(newName)) {
          throw new ServiceError("INVALID_NAME", "Nama server tidak valid.");
        }
        await renameDroplet(dropletId, newName, accountId);
        db.update(services).set({ hostname: newName }).where(eq(services.id, service.id)).run();
        message = `Server diganti nama menjadi ${newName}.`;
        break;
      }
      case "suspend":
        if (!isAdmin) throw new ServiceError("FORBIDDEN", "Hanya admin yang bisa menangguhkan.");
        await dropletAction(dropletId, "power_off", {}, accountId);
        db.update(services).set({ status: "suspended" }).where(eq(services.id, service.id)).run();
        message = "VPS ditangguhkan.";
        break;
      case "unsuspend":
        if (!isAdmin) throw new ServiceError("FORBIDDEN", "Hanya admin yang bisa mengaktifkan.");
        await dropletAction(dropletId, "power_on", {}, accountId);
        db.update(services).set({ status: "active" }).where(eq(services.id, service.id)).run();
        message = "VPS diaktifkan kembali.";
        break;
      case "terminate": {
        if (dropletId) await deleteDroplet(dropletId, accountId);
        db.update(services)
          .set({ status: "terminated", terminatedAt: new Date() })
          .where(eq(services.id, service.id))
          .run();
        message = "VPS telah dihapus permanen.";
        break;
      }
      case "sync": {
        if (!dropletId) throw new ServiceError("NO_DROPLET", "Tidak ada droplet untuk disinkronkan.");
        const droplet = await getDroplet(dropletId, accountId);
        if (!droplet) {
          db.update(services).set({ status: "failed" }).where(eq(services.id, service.id)).run();
          message = "Droplet tidak ditemukan di DigitalOcean. Status ditandai gagal.";
        } else {
          db.update(services)
            .set({
              ipv4: droplet.ipv4,
              ipv6: droplet.ipv6,
              sizeSlug: droplet.size_slug,
              doDropletId: String(droplet.id),
            })
            .where(eq(services.id, service.id))
            .run();
          message = "Data VPS disinkronkan dari DigitalOcean.";
        }
        break;
      }
      default:
        throw new ServiceError("UNKNOWN_ACTION", "Aksi tidak dikenali.");
    }

    logAction({
      serviceId: service.id,
      actor: isAdmin ? "admin" : "user",
      actorId: input.actor.id,
      action: input.action,
      message,
      payload: { image: input.image, name: input.name, snapshotId: input.snapshotId },
    });
    return { message, password };
  } catch (error) {
    const safe = normalizeError(error);
    logAction({
      serviceId: service.id,
      actor: isAdmin ? "admin" : "user",
      actorId: input.actor.id,
      action: input.action,
      message: safe,
      status: "failed",
    });
    throw new ServiceError("ACTION_FAILED", safe);
  }
}

export async function revealRootPassword(input: {
  serviceId: string;
  actor: SessionUser;
  reason?: string;
}): Promise<{ password: string }> {
  const service = getServiceById(input.serviceId);
  if (!service) throw new ServiceError("NOT_FOUND", "VPS tidak ditemukan.");
  if (service.userId !== input.actor.id && input.actor.role !== "admin") {
    throw new ServiceError("FORBIDDEN", "VPS ini bukan milik kamu.");
  }
  if (input.actor.role === "admin" && (!input.reason || input.reason.trim().length < 5)) {
    throw new ServiceError("REASON_REQUIRED", "Alasan akses kredensial wajib diisi (minimal 5 karakter).");
  }
  if (!service.rootPasswordEncrypted) {
    throw new ServiceError("NO_PASSWORD", "Password belum tersedia untuk VPS ini.");
  }
  let password = "";
  try {
    password = decrypt(service.rootPasswordEncrypted);
  } catch {
    throw new ServiceError("DECRYPT_FAILED", "Gagal membaca kredensial. Hubungi admin.");
  }
  await writeAudit({
    actor: input.actor,
    action: "reveal_root_password",
    entity: "service",
    entityId: service.id,
    after: { hostname: service.hostname, reason: input.reason ?? null },
  });
  return { password };
}

export async function resizeServiceForUpgrade(serviceId: string, sizeSlug: string) {
  const service = getServiceById(serviceId);
  if (!service?.doDropletId) return { ok: false };
  try {
    await resizeDroplet(service.doDropletId, sizeSlug, service.doAccountId);
    return { ok: true };
  } catch (error) {
    logAction({
      serviceId,
      actor: "system",
      action: "resize",
      message: normalizeError(error),
      status: "failed",
    });
    return { ok: false };
  }
}

export function serviceActionHistory(serviceId: string) {
  return db
    .select()
    .from(serviceActionsLog)
    .where(eq(serviceActionsLog.serviceId, serviceId))
    .orderBy(desc(serviceActionsLog.createdAt))
    .all();
}

export function userServiceCounts(userId: string) {
  const rows = listUserServices(userId);
  return {
    total: rows.length,
    active: rows.filter((s) => s.status === "active").length,
    suspended: rows.filter((s) => s.status === "suspended").length,
    provisioning: rows.filter((s) => s.status === "provisioning").length,
  };
}
