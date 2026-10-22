import "server-only";

import { and, asc, eq, inArray, lte, or, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  balanceTransactions,
  invoices,
  jobs,
  orders,
  plans,
  services,
  serviceActionsLog,
  sshKeys,
  users,
} from "@/lib/db/schema";
import {
  createDroplet,
  createSshKey,
  DigitalOceanError,
  getDroplet,
  MOCK_SIZES,
  type DoDroplet,
} from "@/lib/digitalocean";
import { getActiveDoAccounts, getDefaultDoAccount } from "@/lib/do-accounts";
import { decrypt, encrypt, randomPassword } from "@/lib/crypto";
import { isMockMode } from "@/lib/settings";
import { addBillingCycle } from "@/lib/pricing";
import { formatDate, formatIDR, uid } from "@/lib/format";
import { notifyAdmins, notifyUserEvent } from "@/lib/notifications";
import { refundOrder } from "./orders";

export type ProvisionSummary = {
  processed: number;
  activated: number;
  failed: number;
  pending: number;
};

function logAction(input: {
  serviceId: string;
  action: string;
  message: string;
  status?: "success" | "failed";
  payload?: Record<string, unknown>;
  actor?: "system" | "admin" | "user";
}) {
  db.insert(serviceActionsLog)
    .values({
      id: uid("sal_", 16),
      serviceId: input.serviceId,
      actor: input.actor ?? "system",
      action: input.action,
      payload: input.payload ?? null,
      resultStatus: input.status ?? "success",
      message: input.message,
    })
    .run();
}

function isPermanentProvisionError(reason: string): boolean {
  return /exceed your droplet limit|droplet limit|limit.*droplet/i.test(reason);
}

function shouldTryNextAccount(error: unknown): boolean {
  if (!(error instanceof DigitalOceanError)) return false;
  if (/exceed your droplet limit|droplet limit|limit.*droplet/i.test(error.message)) return true;
  if (error.code === "network" || error.code === "timeout" || error.code === "no_token") return true;
  return [401, 403, 429, 500, 502, 503, 504].includes(error.status);
}

async function sshKeyForAccount(
  key: {
    id: string;
    publicKey: string;
    doSshKeyId: string | null;
    doSshKeyMap: Record<string, string> | null;
  },
  accountId: string,
  isDefault: boolean,
): Promise<string> {
  const map = { ...(key.doSshKeyMap ?? {}) };
  let sshDoId = map[accountId];
  if (!sshDoId && isDefault && key.doSshKeyId) sshDoId = key.doSshKeyId;
  if (!sshDoId) {
    const created = await createSshKey(`${key.id}-${accountId}`, key.publicKey, accountId);
    sshDoId = created.id;
    map[accountId] = sshDoId;
    db.update(sshKeys)
      .set({
        doSshKeyMap: map,
        doSshKeyId: key.doSshKeyId ?? (isDefault ? sshDoId : null),
      })
      .where(eq(sshKeys.id, key.id))
      .run();
  }
  return sshDoId;
}

async function failJob(jobId: string, serviceId: string, orderId: string | null, reason: string) {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return;
  const attempts = job.attempts + 1;
  const permanent = isPermanentProvisionError(reason);
  const finalAttempt = attempts >= 3 || permanent;
  if (finalAttempt) {
    const finalAttempts = permanent ? Math.max(attempts, 3) : attempts;
    const currentService = db.select().from(services).where(eq(services.id, serviceId)).get();
    const resolvedOrderId = orderId ?? currentService?.orderId ?? null;

    db.transaction((tx) => {
      tx.update(jobs)
        .set({
          status: "failed",
          attempts: finalAttempts,
          lastError: reason,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId))
        .run();
      tx.update(services).set({ status: "failed" }).where(eq(services.id, serviceId)).run();
      if (resolvedOrderId) {
        tx.update(orders)
          .set({ status: "failed", errorMessage: reason })
          .where(eq(orders.id, resolvedOrderId))
          .run();
      }
    });

    const svc = db.select().from(services).where(eq(services.id, serviceId)).get();
    const user = svc ? db.select().from(users).where(eq(users.id, svc.userId)).get() : null;

    let refunded = false;
    let refundAmount = 0;
    if (resolvedOrderId) {
      try {
        const refund = await refundOrder(
          resolvedOrderId,
          "system",
          `Refund otomatis karena provisioning gagal: ${reason}`,
          { reason, notify: false },
        );
        refunded = true;
        refundAmount = refund.amount;
      } catch (error) {
        console.error("[provision] refund otomatis gagal", resolvedOrderId, error);
      }
    }

    logAction({
      serviceId,
      action: "provision",
      message: reason,
      status: "failed",
      payload: { refunded, refundAmount },
    });

    if (svc && user) {
      const refundInfo = refunded
        ? `Dana ${formatIDR(refundAmount)} sudah dikembalikan otomatis ke saldo akunmu.`
        : "Silakan hubungi support untuk bantuan refund.";
      const invoice = resolvedOrderId
        ? db
            .select({ id: invoices.id })
            .from(invoices)
            .where(eq(invoices.orderId, resolvedOrderId))
            .get()
        : null;
      const link = invoice
        ? `/dashboard/invoices/${invoice.id}`
        : resolvedOrderId
          ? `/dashboard/pesanan/${resolvedOrderId}`
          : "/dashboard/vps";
      await notifyUserEvent({
        userId: user.id,
        event: "provisioning_failed",
        title: "VPS gagal dibuat",
        body: `Kami gagal membuat ${svc.hostname}. ${refundInfo}`,
        link,
        emailVars: { hostname: svc.hostname, link, refund_info: refundInfo },
        waPayload: { hostname: svc.hostname, link, refund_info: refundInfo },
      });
      await notifyAdmins({
        type: "provisioning_failed",
        title: "Provisioning gagal",
        body: `${svc.hostname} (${user.email}) gagal: ${reason}${
          refunded ? ` · Refund ${formatIDR(refundAmount)} ke saldo.` : " · Refund otomatis gagal."
        }`,
        link: resolvedOrderId ? `/admin/orders/${resolvedOrderId}` : "/admin/services",
        waEvent: "provisioning_failed",
        waMessage: `Provisioning GAGAL\nHostname: ${svc.hostname}\nUser: ${user.email}\nAlasan: ${reason.slice(0, 200)}\n${
          refunded ? `Refund: ${formatIDR(refundAmount)} ke saldo` : "Refund otomatis GAGAL, cek manual."
        }`,
      });
    }
    return;
  }

  db.update(jobs)
    .set({
      status: "queued",
      attempts,
      lastError: reason,
      notBefore: new Date(Date.now() + 30_000),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId))
    .run();
}

async function runProvisionStep(jobId: string): Promise<"pending" | "active" | "failed"> {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return "failed";
  const svc = db.select().from(services).where(eq(services.id, job.refId)).get();
  if (!svc) {
    db.update(jobs).set({ status: "failed", lastError: "Layanan tidak ditemukan." }).where(eq(jobs.id, job.id)).run();
    return "failed";
  }
  if (svc.status === "terminated") {
    db.update(jobs).set({ status: "done", updatedAt: new Date() }).where(eq(jobs.id, job.id)).run();
    return "failed";
  }
  const order = svc.orderId ? db.select().from(orders).where(eq(orders.id, svc.orderId)).get() : null;
  const plan = db.select().from(plans).where(eq(plans.id, svc.planId)).get();
  const user = db.select().from(users).where(eq(users.id, svc.userId)).get();

  if (!plan || !user) {
    await failJob(job.id, svc.id, order?.id ?? null, "Data paket atau user tidak ditemukan.");
    return "failed";
  }

  // Step 0 — buat droplet pada akun DigitalOcean yang masih punya kapasitas.
  if (job.step === 0) {
    const password = randomPassword(20);
    let dropletId = svc.doDropletId;
    let ipv4 = svc.ipv4;
    let ipv6 = svc.ipv6;
    let accountId: string | null = svc.doAccountId ?? null;
    const sshKey = svc.sshKeyId
      ? db.select().from(sshKeys).where(eq(sshKeys.id, svc.sshKeyId)).get()
      : null;

    if (!dropletId) {
      const accounts = getActiveDoAccounts();
      if (accounts.length === 0) {
        throw new DigitalOceanError(
          "Belum ada akun cloud aktif. Tambahkan akun di Pengaturan.",
          400,
          "no_account",
        );
      }

      let lastError: unknown = null;
      for (const account of accounts) {
        try {
          const sshDoId = sshKey
            ? await sshKeyForAccount(sshKey, account.id, account.isDefault)
            : undefined;
          const created = await createDroplet({
            name: svc.hostname,
            region: svc.regionSlug,
            size: plan.doSizeSlug || svc.sizeSlug,
            image: svc.osSlug,
            ssh_keys: sshDoId ? [sshDoId] : undefined,
            tags: ["vps-store", `user-${user.id}`, `service-${svc.id}`],
            user_data: `#cloud-config\nssh_pwauth: true\nchpasswd:\n  list: |\n    root:${password}\n  expire: false\n`,
            accountId: account.id,
          });
          dropletId = String(created.id);
          ipv4 = created.ipv4;
          ipv6 = created.ipv6;
          accountId = account.id;
          lastError = null;
          logAction({
            serviceId: svc.id,
            action: "create_droplet",
            message: `Droplet ${dropletId} dibuat di ${svc.regionSlug} pada akun ${account.name}.`,
            payload: {
              dropletId,
              region: svc.regionSlug,
              size: plan.doSizeSlug,
              accountId: account.id,
              accountName: account.name,
            },
          });
          break;
        } catch (error) {
          lastError = error;
          if (shouldTryNextAccount(error) && accounts.length > 1) {
            const message = error instanceof Error ? error.message : "Akun tidak dapat dipakai.";
            logAction({
              serviceId: svc.id,
              action: "create_droplet",
              message: `Akun ${account.name} dilewati: ${message}`,
              status: "failed",
              payload: { accountId: account.id, accountName: account.name, reason: message },
            });
            continue;
          }
          throw error;
        }
      }
      if (!dropletId) {
        throw lastError instanceof Error
          ? lastError
          : new Error("Gagal membuat droplet di seluruh akun cloud.");
      }
    } else {
      accountId = accountId ?? getDefaultDoAccount()?.id ?? null;
    }

    if (!accountId) {
      throw new DigitalOceanError(
        "Akun cloud untuk layanan ini tidak ditemukan.",
        400,
        "no_account",
      );
    }

    db.update(services)
      .set({
        doAccountId: accountId,
        doDropletId: dropletId,
        ipv4,
        ipv6,
        rootPasswordEncrypted: encrypt(password),
        status: "provisioning",
      })
      .where(eq(services.id, svc.id))
      .run();

    db.update(jobs)
      .set({
        status: "queued",
        step: 1,
        notBefore: new Date(Date.now() + (isMockMode() ? 6000 : 10_000)),
        payload: { ...(job.payload ?? {}), dropletId },
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id))
      .run();
    return "pending";
  }

  // Step 1 — tunggu droplet aktif lalu finalisasi.
  if (!svc.doDropletId) {
    await failJob(job.id, svc.id, order?.id ?? null, "ID droplet tidak tersedia.");
    return "failed";
  }

  const droplet = await getDroplet(svc.doDropletId, svc.doAccountId);
  const started = job.createdAt?.getTime() ?? Date.now();
  const timedOut = Date.now() - started > 5 * 60 * 1000;

  if (!droplet) {
    await failJob(job.id, svc.id, order?.id ?? null, "Droplet tidak ditemukan pada penyedia cloud.");
    return "failed";
  }
  if (droplet.status !== "active" && !isMockMode()) {
    if (timedOut) {
      await failJob(job.id, svc.id, order?.id ?? null, "Droplet tidak aktif dalam 5 menit.");
      return "failed";
    }
    db.update(jobs)
      .set({ status: "queued", notBefore: new Date(Date.now() + 10_000), updatedAt: new Date() })
      .where(eq(jobs.id, job.id))
      .run();
    return "pending";
  }

  const now = new Date();
  const cycle = svc.billingCycle ?? order?.billingCycle ?? "monthly";
  const periodEnd = svc.periodEnd ?? addBillingCycle(now, cycle);
  const passwordEnc = svc.rootPasswordEncrypted ?? encrypt(randomPassword(20));

  db.transaction((tx) => {
    tx.update(services)
      .set({
        status: "active",
        ipv4: droplet.ipv4 ?? svc.ipv4,
        ipv6: droplet.ipv6 ?? svc.ipv6,
        rootPasswordEncrypted: passwordEnc,
        periodStart: svc.periodStart ?? now,
        periodEnd,
        sizeSlug: droplet.size_slug ?? svc.sizeSlug,
      })
      .where(eq(services.id, svc.id))
      .run();
    if (order) {
      tx.update(orders)
        .set({ status: "active", errorMessage: null })
        .where(eq(orders.id, order.id))
        .run();
    }
    tx.update(jobs)
      .set({ status: "done", step: 2, updatedAt: new Date() })
      .where(eq(jobs.id, job.id))
      .run();
  });

  logAction({
    serviceId: svc.id,
    action: "provision",
    message: `VPS aktif dengan IP ${droplet.ipv4 ?? "—"}.`,
    payload: { dropletId: svc.doDropletId, ipv4: droplet.ipv4 },
  });

  let password = "";
  try {
    password = decrypt(passwordEnc);
  } catch {
    password = "";
  }

  await notifyUserEvent({
    userId: user.id,
    event: "provisioning_done",
    title: "VPS kamu sudah aktif",
    body: `${svc.hostname} aktif di ${droplet.ipv4 ?? "—"}. Detail akses dikirim ke email dan WhatsApp.`,
    link: `/dashboard/vps/${svc.id}`,
    emailVars: {
      nama_paket: plan.name,
      hostname: svc.hostname,
      ip: droplet.ipv4 ?? "—",
      password,
      region: svc.regionSlug,
      os: svc.osSlug,
      jatuh_tempo: formatDate(periodEnd),
      link: `/dashboard/vps/${svc.id}`,
    },
    waPayload: {
      nama_paket: plan.name,
      hostname: svc.hostname,
      ip: droplet.ipv4 ?? "—",
      password,
      region: svc.regionSlug,
      os: svc.osSlug,
      jatuh_tempo: formatDate(periodEnd),
      link: `/dashboard/vps/${svc.id}`,
      total: formatIDR(order?.priceSnapshot.total ?? 0),
    },
  });

  return "active";
}

export async function processDueJobs(limit = 10): Promise<ProvisionSummary> {
  const now = new Date();
  const due = db
    .select()
    .from(jobs)
    .where(
      and(
        inArray(jobs.status, ["queued"]),
        or(isNull(jobs.notBefore), lte(jobs.notBefore, now)),
      ),
    )
    .limit(limit)
    .all();

  const summary: ProvisionSummary = { processed: 0, activated: 0, failed: 0, pending: 0 };
  for (const job of due) {
    db.update(jobs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(jobs.id, job.id))
      .run();
    summary.processed++;
    try {
      const result = await runProvisionStep(job.id);
      if (result === "active") summary.activated++;
      else if (result === "failed") summary.failed++;
      else summary.pending++;
    } catch (error) {
      const message =
        error instanceof DigitalOceanError
          ? "Provisioning gagal pada penyedia cloud. Coba lagi beberapa saat."
          : error instanceof Error && error.message
            ? error.message.slice(0, 300)
            : "Kesalahan tidak diketahui saat provisioning.";
      try {
        await failJob(job.id, job.refId, null, message);
      } catch (inner) {
        console.error("[provision] gagal menyimpan error job", inner);
      }
      summary.failed++;
    }
  }
  return summary;
}

/**
 * Backfill untuk job provisioning yang sudah final gagal tetapi refund-nya
 * belum tercatat (misalnya job gagal sebelum fitur refund otomatis aktif).
 */
export async function refundFailedProvisioning(
  limit = 10,
): Promise<{ checked: number; refunded: number }> {
  const failedJobs = db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, "provision_service"), eq(jobs.status, "failed")))
    .orderBy(asc(jobs.createdAt))
    .limit(limit)
    .all();

  let refunded = 0;
  for (const job of failedJobs) {
    const svc = db.select().from(services).where(eq(services.id, job.refId)).get();
    if (!svc || svc.status !== "failed" || !svc.orderId) continue;
    const order = db.select().from(orders).where(eq(orders.id, svc.orderId)).get();
    if (!order || !["failed", "provisioning"].includes(order.status)) continue;
    const existingRefund = db
      .select()
      .from(balanceTransactions)
      .where(
        and(
          eq(balanceTransactions.ref, order.id),
          eq(balanceTransactions.type, "refund"),
        ),
      )
      .get();
    if (existingRefund) continue;

    const reason = job.lastError ?? "Provisioning tidak berhasil diselesaikan.";
    try {
      const result = await refundOrder(
        order.id,
        "system",
        `Refund otomatis karena provisioning gagal: ${reason}`,
        { reason },
      );
      if (!result.alreadyRefunded) {
        refunded++;
        logAction({
          serviceId: svc.id,
          action: "refund",
          message: `Refund otomatis ${formatIDR(result.amount)} ke saldo pengguna.`,
          payload: { orderId: order.id, amount: result.amount, reason },
        });
      }
    } catch (error) {
      console.error("[provision] backfill refund gagal", order.id, error);
    }
  }
  return { checked: failedJobs.length, refunded };
}

export function getProvisioningJob(serviceId: string) {
  return db
    .select()
    .from(jobs)
    .where(and(eq(jobs.refId, serviceId), eq(jobs.type, "provision_service")))
    .all()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export type ProvisioningProgressPhase =
  | "queued"
  | "creating"
  | "booting"
  | "finalizing"
  | "active"
  | "failed";

export type ProvisioningProgress = {
  phase: ProvisioningProgressPhase;
  progress: number;
  label: string;
  detail: string;
  serverStatus: string | null;
  jobStep: number | null;
  elapsedSeconds: number;
  checkedAt: string;
};

function friendlyServerStatus(status: string | null | undefined) {
  if (!status) return null;
  if (status === "new") return "Sedang dinyalakan";
  if (status === "active") return "Aktif";
  if (status === "off") return "Nonaktif";
  if (status === "archive") return "Diarsipkan";
  return "Diproses";
}

/**
 * Progres provisioning untuk ditampilkan ke pengguna. Status droplet diambil
 * langsung dari penyedia cloud agar alert tidak hanya bergantung pada step job.
 */
export async function getProvisioningProgress(
  serviceId: string,
): Promise<ProvisioningProgress | null> {
  const svc = db.select().from(services).where(eq(services.id, serviceId)).get();
  if (!svc) return null;

  const job = getProvisioningJob(serviceId);
  const startedAt = job?.createdAt ?? svc.createdAt;
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));
  const checkedAt = new Date().toISOString();

  let droplet: DoDroplet | null = null;
  let dropletCheckFailed = false;
  if (svc.status === "provisioning" && svc.doDropletId) {
    try {
      droplet = await getDroplet(svc.doDropletId, svc.doAccountId);
    } catch (error) {
      dropletCheckFailed = true;
      console.error("[provision] gagal memeriksa status droplet", svc.id, error);
    }
  }

  const base = {
    serverStatus: friendlyServerStatus(droplet?.status),
    jobStep: job?.step ?? null,
    elapsedSeconds,
    checkedAt,
  };

  if (svc.status === "active") {
    return {
      ...base,
      phase: "active",
      progress: 100,
      label: "Server aktif",
      detail: "Server siap digunakan.",
    };
  }

  if (svc.status === "failed" || svc.status === "terminated" || job?.status === "failed") {
    return {
      ...base,
      phase: "failed",
      progress: 100,
      label: "Server gagal disiapkan",
      detail:
        "Kami tidak dapat menyelesaikan penyiapan server. Cek detail pesanan atau hubungi support untuk bantuan.",
    };
  }

  if (!job) {
    return {
      ...base,
      phase: "queued",
      progress: 10,
      label: "Menunggu antrean server",
      detail: "Pesanan sudah diterima. Server akan segera diproses.",
    };
  }

  if (job.status === "done") {
    return {
      ...base,
      phase: "finalizing",
      progress: 95,
      label: "Menyelesaikan konfigurasi",
      detail: "Server aktif. Menyimpan akses dan menyiapkan panel.",
    };
  }

  if (job.step === 0 && !svc.doDropletId) {
    return {
      ...base,
      phase: "creating",
      progress: 20,
      label: "Membuat server",
      detail: "Permintaan pembuatan server sedang diproses.",
    };
  }

  if (svc.doDropletId) {
    if (dropletCheckFailed) {
      return {
        ...base,
        phase: "booting",
        progress: 55,
        label: "Menunggu status server",
        detail: "Status server belum dapat diperiksa. Kami akan mencoba lagi otomatis.",
      };
    }
    if (!droplet) {
      return {
        ...base,
        phase: "booting",
        progress: 45,
        label: "Menunggu server muncul",
        detail: "Server sudah diminta. Menunggu status terbaru dari penyedia.",
      };
    }
    if (droplet.status === "new") {
      return {
        ...base,
        phase: "booting",
        progress: 68,
        label: "Server sedang dinyalakan",
        detail: "Server sudah dibuat dan sedang dalam proses booting.",
      };
    }
    if (droplet.status === "active") {
      return {
        ...base,
        phase: "finalizing",
        progress: 90,
        label: "Server aktif, menyelesaikan konfigurasi",
        detail: "Menyimpan akses dan mengaktifkan layanan.",
      };
    }
    return {
      ...base,
      phase: "booting",
      progress: 60,
      label: "Menunggu server siap",
      detail: `Status server saat ini: ${friendlyServerStatus(droplet.status) ?? "diproses"}.`,
    };
  }

  return {
    ...base,
    phase: "creating",
    progress: 35,
    label: "Membuat server",
    detail: "Server sedang disiapkan.",
  };
}

export function mockSizeSpec(slug: string) {
  return MOCK_SIZES.find((s) => s.slug === slug);
}
