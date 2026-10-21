import "server-only";

import { addDays } from "date-fns";
import { and, eq, gte, inArray, lte, ne, isNull, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cronLogs,
  invoices,
  payments,
  reminderLog,
  services,
  users,
  waOutbox,
} from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/settings";
import { dropletAction, deleteDroplet, getDroplet, listDropletsByTag } from "@/lib/digitalocean";
import { getActiveDoAccounts } from "@/lib/do-accounts";
import { notifyAdmins, notifyUserEvent } from "@/lib/notifications";
import { formatDateTime, uid } from "@/lib/format";
import { differenceInWibCalendarDays } from "@/lib/time";
import { cycleUnitPrice } from "@/lib/pricing";
import { plans } from "@/lib/db/schema";
import { syncDoCatalog } from "./do-catalog";
import { createRenewalInvoice, settleInvoice } from "./billing";
import { processDueJobs, refundFailedProvisioning } from "./provisioning";
import { expireInvoices } from "./orders";
import { reconcileTripayPayment } from "./tripay";
import { tripayEnabled } from "@/lib/payments/tripay";

export type CronSummary = Record<string, unknown>;

async function reminders(): Promise<number> {
  const now = new Date();
  const thresholds = (getSetting("invoice_due_reminder_days") || "3,1")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
  const maxThreshold = Math.max(1, ...thresholds);
  const upcoming = db
    .select()
    .from(services)
    .where(
      and(
        eq(services.status, "active"),
        lte(services.periodEnd, addDays(now, maxThreshold + 1)),
      ),
    )
    .all();

  let sent = 0;
  for (const svc of upcoming) {
    if (!svc.periodEnd) continue;
    const weekly = svc.billingCycle === "weekly";
    // Selisih hari dihitung berdasarkan kalender WIB, bukan timezone server (UTC).
    const days = differenceInWibCalendarDays(svc.periodEnd, now);
    const serviceThresholds = weekly ? [1] : thresholds;

    for (const threshold of serviceThresholds) {
      if (days > threshold || days < 0) continue;

      let kind = weekly ? "weekly-h-1" : `h-${threshold}`;
      if (weekly) {
        // H-1 adalah pengingat utama. H-0 hanya fallback bila cron terlewat.
        if (days === 0) {
          const hMinusOneSent = db
            .select()
            .from(reminderLog)
            .where(
              and(
                eq(reminderLog.serviceId, svc.id),
                eq(reminderLog.kind, "weekly-h-1"),
                eq(reminderLog.periodEnd, svc.periodEnd),
              ),
            )
            .get();
          if (hMinusOneSent) continue;
          kind = "weekly-h-0";
        } else if (days !== 1) {
          continue;
        }
      }

      const exists = db
        .select()
        .from(reminderLog)
        .where(
          and(
            eq(reminderLog.serviceId, svc.id),
            eq(reminderLog.kind, kind),
            eq(reminderLog.periodEnd, svc.periodEnd),
          ),
        )
        .get();
      if (exists) continue;

      const user = db.select().from(users).where(eq(users.id, svc.userId)).get();
      if (!user) continue;
      const expiry = formatDateTime(svc.periodEnd);
      const title = weekly ? "VPS mingguan segera berakhir" : "VPS akan jatuh tempo";
      const body = weekly
        ? days === 1
          ? `${svc.hostname} akan berakhir ${expiry}. VPS mingguan akan dihapus otomatis setelah masa aktif. Perpanjang sekarang agar data tidak hilang.`
          : `${svc.hostname} berakhir hari ini (${expiry}). VPS mingguan akan dihapus otomatis. Perpanjang sekarang agar data tidak hilang.`
        : `${svc.hostname} jatuh tempo ${expiry}. Perpanjang agar layanan tidak ditangguhkan.`;

      await notifyUserEvent({
        userId: user.id,
        event: weekly ? "weekly_expiry_reminder" : "invoice_reminder",
        title,
        body,
        link: `/dashboard/vps/${svc.id}`,
        emailVars: {
          hostname: svc.hostname,
          jatuh_tempo: expiry,
          link: `/dashboard/vps/${svc.id}`,
        },
        waPayload: {
          hostname: svc.hostname,
          jatuh_tempo: expiry,
          link: `/dashboard/vps/${svc.id}`,
        },
      });
      db.insert(reminderLog)
        .values({ id: uid("rmd_", 16), serviceId: svc.id, kind, periodEnd: svc.periodEnd })
        .run();
      sent++;
    }
  }
  return sent;
}

/**
 * VPS mingguan tidak memakai masa tenggang. Begitu 7 hari selesai (berdasarkan
 * periodEnd), droplet dihapus otomatis dan layanan ditandai terminated.
 */
async function weeklyExpirations(): Promise<{ deleted: number; failed: number }> {
  const now = new Date();
  const due = db
    .select()
    .from(services)
    .where(
      and(
        eq(services.billingCycle, "weekly"),
        inArray(services.status, ["active", "suspended"]),
        lte(services.periodEnd, now),
      ),
    )
    .all();

  let deleted = 0;
  let failed = 0;
  for (const svc of due) {
    try {
      if (svc.doDropletId) await deleteDroplet(svc.doDropletId, svc.doAccountId);
      db.update(services)
        .set({ status: "terminated", terminatedAt: new Date() })
        .where(eq(services.id, svc.id))
        .run();
      const user = db.select().from(users).where(eq(users.id, svc.userId)).get();
      if (user) {
        await notifyUserEvent({
          userId: user.id,
          event: "service_terminated",
          title: "VPS mingguan telah dihapus",
          body: `${svc.hostname} telah dihapus otomatis karena masa aktif 7 hari berakhir pada ${formatDateTime(svc.periodEnd)}.`,
          link: "/dashboard/vps",
          emailVars: {
            hostname: svc.hostname,
            jatuh_tempo: formatDateTime(svc.periodEnd),
            link: "/dashboard/vps",
          },
          waPayload: {
            hostname: svc.hostname,
            jatuh_tempo: formatDateTime(svc.periodEnd),
            link: "/dashboard/vps",
          },
        });
      }
      await notifyAdmins({
        type: "service_terminated",
        title: "VPS mingguan dihapus otomatis",
        body: `${svc.hostname} dihapus otomatis setelah masa aktif 7 hari (${formatDateTime(svc.periodEnd)}).`,
        link: `/admin/services/${svc.id}`,
        waEvent: "service_terminated",
        waMessage: `VPS mingguan dihapus otomatis: ${svc.hostname} (${user?.email ?? "—"}).`,
      });
      deleted++;
    } catch (error) {
      failed++;
      console.error("[cron] hapus VPS mingguan gagal", svc.id, error);
    }
  }
  return { deleted, failed };
}

async function renewals(): Promise<{ renewed: number; suspended: number }> {
  const now = new Date();
  const due = db
    .select()
    .from(services)
    .where(
      and(
        eq(services.status, "active"),
        ne(services.billingCycle, "weekly"),
        lte(services.periodEnd, now),
      ),
    )
    .all();
  let renewed = 0;
  let suspended = 0;

  for (const svc of due) {
    const user = db.select().from(users).where(eq(users.id, svc.userId)).get();
    const plan = db.select().from(plans).where(eq(plans.id, svc.planId)).get();
    if (!user || !plan) continue;
    const price = cycleUnitPrice(plan, "monthly");

    if (svc.autoRenew && user.balance >= price) {
      try {
        const { invoice } = await createRenewalInvoice({
          userId: user.id,
          serviceId: svc.id,
          cycle: "monthly",
        });
        await settleInvoice({
          invoiceId: invoice.id,
          provider: "balance",
          method: "auto-renew",
          providerRef: `AUTO-${invoice.invoiceNumber}`,
          deductBalance: true,
        });
        renewed++;
      } catch (error) {
        console.error("[cron] auto renew gagal", error);
      }
      continue;
    }

    try {
      if (svc.doDropletId) await dropletAction(svc.doDropletId, "power_off", {}, svc.doAccountId);
      db.update(services).set({ status: "suspended" }).where(eq(services.id, svc.id)).run();
      await notifyUserEvent({
        userId: user.id,
        event: "service_suspended",
        title: "VPS ditangguhkan",
        body: `${svc.hostname} ditangguhkan karena masa aktif berakhir. Data tersimpan selama masa tenggang.`,
        link: `/dashboard/vps/${svc.id}`,
        emailVars: { hostname: svc.hostname, link: `/dashboard/vps/${svc.id}` },
        waPayload: { hostname: svc.hostname, link: `/dashboard/vps/${svc.id}` },
      });
      suspended++;
    } catch (error) {
      console.error("[cron] suspend gagal", error);
    }
  }
  return { renewed, suspended };
}

async function terminations(): Promise<number> {
  const grace = Number(getSetting("grace_period_days") || 3);
  const cutoff = addDays(new Date(), -grace);
  const expired = db
    .select()
    .from(services)
    .where(
      and(
        eq(services.status, "suspended"),
        ne(services.billingCycle, "weekly"),
        lte(services.periodEnd, cutoff),
      ),
    )
    .all();
  let count = 0;
  for (const svc of expired) {
    try {
      if (svc.doDropletId) await deleteDroplet(svc.doDropletId, svc.doAccountId);
      db.update(services)
        .set({ status: "terminated", terminatedAt: new Date() })
        .where(eq(services.id, svc.id))
        .run();
      const user = db.select().from(users).where(eq(users.id, svc.userId)).get();
      if (user) {
        await notifyUserEvent({
          userId: user.id,
          event: "service_terminated",
          title: "VPS dihentikan",
          body: `${svc.hostname} telah dihentikan dan droplet dihapus karena melewati masa tenggang.`,
          link: "/dashboard/vps",
          emailVars: { hostname: svc.hostname, link: "/dashboard/vps" },
          waPayload: { hostname: svc.hostname },
        });
      }
      await notifyAdmins({
        type: "service_terminated",
        title: "VPS dihentikan otomatis",
        body: `${svc.hostname} dihentikan otomatis setelah masa tenggang.`,
        link: `/admin/services/${svc.id}`,
        waEvent: "service_terminated",
        waMessage: `Service terminate otomatis: ${svc.hostname} (${user?.email ?? "—"}).`,
      });
      count++;
    } catch (error) {
      console.error("[cron] terminate gagal", error);
    }
  }
  return count;
}

async function syncDroplets(): Promise<{ synced: number; missing: number }> {
  const active = db
    .select()
    .from(services)
    .where(and(eq(services.status, "active"), isNull(services.terminatedAt)))
    .limit(20)
    .all();
  let synced = 0;
  let missing = 0;
  for (const svc of active) {
    if (!svc.doDropletId) continue;
    try {
      const droplet = await getDroplet(svc.doDropletId, svc.doAccountId);
      if (!droplet) {
        db.update(services).set({ status: "failed" }).where(eq(services.id, svc.id)).run();
        missing++;
        await notifyAdmins({
          type: "service_missing",
          title: "Droplet hilang dari server cloud",
          body: `${svc.hostname} (${svc.doDropletId}) tidak ditemukan saat sinkronisasi.`,
          link: `/admin/services/${svc.id}`,
          waEvent: "provisioning_failed",
          waMessage: `Droplet hilang: ${svc.hostname} (${svc.doDropletId}).`,
        });
        continue;
      }
      db.update(services)
        .set({ ipv4: droplet.ipv4, ipv6: droplet.ipv6, sizeSlug: droplet.size_slug })
        .where(eq(services.id, svc.id))
        .run();
      synced++;
    } catch (error) {
      console.error("[cron] sync droplet gagal", error);
    }
  }
  return { synced, missing };
}

async function syncCatalog(): Promise<{ skipped: boolean; created?: number; updated?: number }> {
  const last = Number(getSetting("do_catalog_last_sync") || 0);
  if (last && Date.now() - last < 60 * 60 * 1000) return { skipped: true };
  try {
    const result = await syncDoCatalog();
    return { skipped: false, created: result.created, updated: result.updated };
  } finally {
    setSetting("do_catalog_last_sync", String(Date.now()));
  }
}

async function waQueue(): Promise<{ processed: boolean; stale: number }> {
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000);
  const stale = db
    .select()
    .from(waOutbox)
    .where(and(eq(waOutbox.status, "sending"), lte(waOutbox.updatedAt, staleCutoff)))
    .all();
  for (const row of stale) {
    db.update(waOutbox)
      .set({ status: "queued", lastError: "Worker timeout, dikembalikan ke antrean.", updatedAt: new Date() })
      .where(eq(waOutbox.id, row.id))
      .run();
  }

  let processed = false;
  try {
    const res = await fetch(`${process.env.WA_WORKER_URL ?? "http://127.0.0.1:3001"}/process-outbox`, {
      method: "POST",
      headers: { "x-internal-secret": process.env.INTERNAL_SECRET ?? "" },
      signal: AbortSignal.timeout(5000),
    });
    processed = res.ok;
  } catch {
    processed = false;
  }
  return { processed, stale: stale.length };
}

async function syncTripayPayments(): Promise<{ checked: number; settled: number }> {
  if (!tripayEnabled()) return { checked: 0, settled: 0 };

  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const rows = db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.provider, "tripay"),
        eq(payments.status, "pending"),
        gte(payments.createdAt, cutoff),
      ),
    )
    .orderBy(asc(payments.createdAt))
    .limit(5)
    .all();

  let settled = 0;
  for (const payment of rows) {
    if (Date.now() - payment.createdAt.getTime() < 5000) continue;
    const invoice = db.select().from(invoices).where(eq(invoices.id, payment.invoiceId)).get();
    if (!invoice || (invoice.status !== "unpaid" && invoice.status !== "expired")) continue;
    try {
      const result = await reconcileTripayPayment({
        invoice,
        reference: payment.providerRef,
      });
      if (result.settled) settled++;
    } catch (error) {
      console.warn("[cron] sync tripay gagal", payment.id, error);
    }
  }
  return { checked: rows.length, settled };
}

export async function runCron(): Promise<CronSummary> {
  const startedAt = new Date();
  const summary: CronSummary = {};
  let failures = 0;
  const tasks: [string, () => Promise<unknown>][] = [
    ["provisioning", () => processDueJobs(20)],
    ["refund_failed_provisioning", () => refundFailedProvisioning(10)],
    ["expire_invoices", async () => expireInvoices()],
    ["reminders", reminders],
    ["weekly_expirations", weeklyExpirations],
    ["renewals", renewals],
    ["terminations", terminations],
    ["sync_droplets", syncDroplets],
    ["sync_catalog", syncCatalog],
    ["sync_tripay", syncTripayPayments],
    ["wa_outbox", waQueue],
  ];

  for (const [name, task] of tasks) {
    try {
      summary[name] = await task();
    } catch (error) {
      failures++;
      summary[name] = { error: error instanceof Error ? error.message : "unknown" };
      console.error(`[cron] ${name} gagal`, error);
    }
  }

  const finishedAt = new Date();
  db.insert(cronLogs)
    .values({
      id: uid("cron_", 16),
      job: "run_all",
      status: failures === 0 ? "success" : failures >= tasks.length ? "failed" : "partial",
      summary,
      startedAt,
      finishedAt,
    })
    .run();

  return summary;
}

export function cronHistory(limit = 30) {
  return db.select().from(cronLogs).orderBy(asc(cronLogs.createdAt)).all().slice(-limit).reverse();
}

export async function reconcileDroplets() {
  const accounts = getActiveDoAccounts();
  let total = 0;
  for (const account of accounts) {
    const rows = await listDropletsByTag("vps-store", 1, account.id);
    total += rows.length;
  }
  return total;
}
