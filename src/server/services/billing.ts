import "server-only";

import { addMonths } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  balanceTransactions,
  invoices,
  jobs,
  orders,
  payments,
  plans,
  services,
  users,
  type Invoice,
  type Order,
  type Service,
} from "@/lib/db/schema";
import { getSettings, isMockMode } from "@/lib/settings";
import { CYCLE_MONTHS } from "@/lib/pricing";
import { cycleUnitPrice, upgradeProration } from "@/lib/pricing";
import { formatIDR, invoiceNumber as makeInvoiceNumber, uid } from "@/lib/format";
import { invoiceExpiryDate } from "@/lib/invoices";
import { notifyAdmins, notifyUserEvent } from "@/lib/notifications";

export class BillingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "BillingError";
    this.code = code;
  }
}

export type SettleInput = {
  invoiceId: string;
  provider: string;
  providerRef?: string | null;
  method?: string | null;
  paymentId?: string | null;
  deductBalance?: boolean;
  verifiedBy?: string | null;
  rawWebhook?: Record<string, unknown> | null;
};

export type SettleResult = {
  alreadyPaid: boolean;
  invoice: Invoice;
  user: { id: string; name: string; email: string; phone: string | null; balance: number };
  order?: Order;
  service?: Service;
  planName?: string;
  resize?: { serviceId: string; sizeSlug: string };
};

function ensureInvoice(id: string): Invoice {
  const inv = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!inv) throw new BillingError("NOT_FOUND", "Invoice tidak ditemukan.");
  return inv;
}

/**
 * Menyelesaikan invoice secara idempotent: update status, saldo, layanan,
 * provision job, dan efek samping lain dalam satu transaksi SQLite.
 */
export async function settleInvoice(input: SettleInput): Promise<SettleResult> {
  const currentUser = ensureInvoice(input.invoiceId);
  const currentUserRow = db.select().from(users).where(eq(users.id, currentUser.userId)).get();
  if (!currentUserRow) throw new BillingError("NOT_FOUND", "Pemilik invoice tidak ditemukan.");

  if (currentUser.status === "paid") {
    return {
      alreadyPaid: true,
      invoice: currentUser,
      user: {
        id: currentUserRow.id,
        name: currentUserRow.name,
        email: currentUserRow.email,
        phone: currentUserRow.phone,
        balance: currentUserRow.balance,
      },
    };
  }
  if (currentUser.status !== "unpaid") {
    throw new BillingError("INVALID_STATE", "Invoice ini tidak dapat dibayar.");
  }

  const result = db.transaction((tx) => {
    const invoice = tx.select().from(invoices).where(eq(invoices.id, input.invoiceId)).get();
    if (!invoice) throw new BillingError("NOT_FOUND", "Invoice tidak ditemukan.");
    if (invoice.status === "paid") {
      const u = tx.select().from(users).where(eq(users.id, invoice.userId)).get()!;
      return {
        alreadyPaid: true,
        invoice,
        user: { id: u.id, name: u.name, email: u.email, phone: u.phone, balance: u.balance },
      } as SettleResult;
    }
    if (invoice.status !== "unpaid") {
      throw new BillingError("INVALID_STATE", "Invoice ini tidak dapat dibayar.");
    }

    const user = tx.select().from(users).where(eq(users.id, invoice.userId)).get();
    if (!user) throw new BillingError("NOT_FOUND", "User tidak ditemukan.");

    let balance = user.balance;
    if (input.deductBalance) {
      if (balance < invoice.amount) {
        throw new BillingError("INSUFFICIENT_BALANCE", "Saldo tidak mencukupi.");
      }
      balance -= invoice.amount;
      tx.update(users)
        .set({ balance, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .run();
      tx.insert(balanceTransactions)
        .values({
          id: uid("bt_", 16),
          userId: user.id,
          type: "payment",
          amount: -invoice.amount,
          balanceAfter: balance,
          ref: invoice.id,
          note: `Pembayaran ${invoice.invoiceNumber}`,
          createdBy: user.id,
        })
        .run();
    }

    if (input.paymentId) {
      tx.update(payments)
        .set({
          status: "paid",
          providerRef: input.providerRef ?? undefined,
          verifiedBy: input.verifiedBy ?? null,
          rawWebhook: input.rawWebhook ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, input.paymentId))
        .run();
    } else {
      tx.insert(payments)
        .values({
          id: uid("pay_", 16),
          invoiceId: invoice.id,
          provider: input.provider,
          providerRef: input.providerRef ?? invoice.invoiceNumber,
          method: input.method ?? input.provider,
          amount: invoice.amount,
          status: "paid",
          rawWebhook: input.rawWebhook ?? null,
          verifiedBy: input.verifiedBy ?? null,
        })
        .run();
    }

    tx.update(invoices)
      .set({
        status: "paid",
        paidAt: new Date(),
        paymentProvider: input.provider,
        paymentRef: input.providerRef ?? invoice.invoiceNumber,
      })
      .where(eq(invoices.id, invoice.id))
      .run();

    let order: Order | undefined;
    let service: Service | undefined;
    let planName: string | undefined;
    let resize: { serviceId: string; sizeSlug: string } | undefined;

    if (invoice.type === "topup") {
      balance += invoice.amount;
      tx.update(users)
        .set({ balance, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .run();
      tx.insert(balanceTransactions)
        .values({
          id: uid("bt_", 16),
          userId: user.id,
          type: "topup",
          amount: invoice.amount,
          balanceAfter: balance,
          ref: invoice.id,
          note: `Top up saldo ${invoice.invoiceNumber}`,
          createdBy: user.id,
        })
        .run();
    }

    if (invoice.type === "new" && invoice.orderId) {
      const orderRow = tx.select().from(orders).where(eq(orders.id, invoice.orderId)).get();
      if (orderRow) {
        order = orderRow;
        const plan = tx.select().from(plans).where(eq(plans.id, orderRow.planId)).get();
        planName = plan?.name;
        const months = orderRow.priceSnapshot.months ?? 1;
        const now = new Date();
        const serviceId = uid("srv_", 16);
        tx.insert(services)
          .values({
            id: serviceId,
            userId: user.id,
            orderId: orderRow.id,
            planId: orderRow.planId,
            hostname: orderRow.hostname,
            regionSlug: orderRow.regionSlug,
            osSlug: orderRow.osSlug,
            sizeSlug: plan?.doSizeSlug ?? "",
            sshKeyId: orderRow.sshKeyId,
            status: "provisioning",
            periodStart: now,
            periodEnd: addMonths(now, months),
            autoRenew: true,
          })
          .run();
        tx.update(orders)
          .set({ status: "provisioning", paidAt: new Date() })
          .where(eq(orders.id, orderRow.id))
          .run();
        const jobId = uid("job_", 16);
        tx.insert(jobs)
          .values({
            id: jobId,
            type: "provision_service",
            refId: serviceId,
            status: "queued",
            step: 0,
            notBefore: new Date(Date.now() + (isMockMode() ? 8000 + Math.random() * 7000 : 0)),
            payload: { orderId: orderRow.id },
            updatedAt: new Date(),
          })
          .run();
        service = tx.select().from(services).where(eq(services.id, serviceId)).get();
      }
    }

    if (invoice.type === "renewal" && invoice.serviceId) {
      const svc = tx.select().from(services).where(eq(services.id, invoice.serviceId)).get();
      if (svc) {
        const meta = (invoice.metadata ?? {}) as { cycle?: keyof typeof CYCLE_MONTHS };
        const months = CYCLE_MONTHS[meta.cycle ?? "monthly"] ?? 1;
        const from = svc.periodEnd && svc.periodEnd > new Date() ? svc.periodEnd : new Date();
        const next = addMonths(from, months);
        tx.update(services)
          .set({ periodEnd: next, status: svc.status === "suspended" ? "suspended" : "active" })
          .where(eq(services.id, svc.id))
          .run();
        service = { ...svc, periodEnd: next };
        planName = tx.select().from(plans).where(eq(plans.id, svc.planId)).get()?.name;
      }
    }

    if (invoice.type === "upgrade" && invoice.serviceId) {
      const svc = tx.select().from(services).where(eq(services.id, invoice.serviceId)).get();
      if (svc) {
        const meta = (invoice.metadata ?? {}) as {
          targetPlanId?: number;
          targetSizeSlug?: string;
          targetPlanName?: string;
        };
        if (meta.targetPlanId) {
          const target = tx.select().from(plans).where(eq(plans.id, meta.targetPlanId)).get();
          tx.update(services)
            .set({
              planId: meta.targetPlanId,
              sizeSlug: meta.targetSizeSlug ?? target?.doSizeSlug ?? svc.sizeSlug,
            })
            .where(eq(services.id, svc.id))
            .run();
          service = {
            ...svc,
            planId: meta.targetPlanId,
            sizeSlug: meta.targetSizeSlug ?? target?.doSizeSlug ?? svc.sizeSlug,
          };
          planName = target?.name;
          resize = {
            serviceId: svc.id,
            sizeSlug: meta.targetSizeSlug ?? target?.doSizeSlug ?? svc.sizeSlug,
          };
        }
      }
    }

    const updatedUser = tx.select().from(users).where(eq(users.id, user.id)).get()!;
    return {
      alreadyPaid: false,
      invoice: { ...invoice, status: "paid", paidAt: new Date() } as Invoice,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        balance: updatedUser.balance,
      },
      order,
      service,
      planName,
      resize,
    } as SettleResult;
  });

  if (!result.alreadyPaid) {
    await afterSettlement(result);
  }
  return result;
}

async function afterSettlement(result: SettleResult) {
  const inv = result.invoice;
  try {
    if (inv.type === "topup") {
      await notifyUserEvent({
        userId: result.user.id,
        event: "payment_paid",
        title: "Top up saldo berhasil",
        body: `Saldo kamu bertambah ${formatIDR(inv.amount)}. Saldo saat ini ${formatIDR(result.user.balance)}.`,
        link: "/dashboard/saldo",
        emailVars: {
          order_number: inv.invoiceNumber,
          total: formatIDR(inv.amount),
          link: "/dashboard/saldo",
        },
        waPayload: {
          order_number: inv.invoiceNumber,
          total: formatIDR(inv.amount),
          link: "/dashboard/saldo",
        },
      });
      return;
    }

    if (inv.type === "new" && result.order) {
      await notifyUserEvent({
        userId: result.user.id,
        event: "payment_paid",
        title: "Pembayaran diterima",
        body: `Pembayaran pesanan ${result.order.orderNumber} sudah kami terima. Server sedang disiapkan.`,
        link: `/dashboard/pesanan/${result.order.id}`,
        emailVars: {
          order_number: result.order.orderNumber,
          total: formatIDR(inv.amount),
          link: `/dashboard/pesanan/${result.order.id}`,
        },
        waPayload: {
          order_number: result.order.orderNumber,
          total: formatIDR(inv.amount),
          link: `/dashboard/pesanan/${result.order.id}`,
        },
      });
      await notifyAdmins({
        type: "payment_paid",
        title: "Pembayaran masuk",
        body: `${result.user.name} membayar ${formatIDR(inv.amount)} untuk ${result.order.orderNumber}.`,
        link: `/admin/orders/${result.order.id}`,
        waEvent: "payment_paid",
        waMessage: `Pembayaran masuk: ${result.order.orderNumber} sebesar ${formatIDR(inv.amount)} dari ${result.user.name}.`,
      });
      return;
    }

    if (inv.type === "renewal" && result.service) {
      await notifyUserEvent({
        userId: result.user.id,
        event: "service_renewed",
        title: "VPS diperpanjang",
        body: `VPS ${result.service.hostname} diperpanjang sampai ${result.service.periodEnd?.toLocaleDateString("id-ID") ?? "—"}.`,
        link: `/dashboard/vps/${result.service.id}`,
        emailVars: {
          hostname: result.service.hostname,
          jatuh_tempo: result.service.periodEnd?.toLocaleDateString("id-ID") ?? "—",
          link: `/dashboard/vps/${result.service.id}`,
        },
        waPayload: {
          hostname: result.service.hostname,
          jatuh_tempo: result.service.periodEnd?.toLocaleDateString("id-ID") ?? "—",
          link: `/dashboard/vps/${result.service.id}`,
        },
      });
      return;
    }

    if (inv.type === "upgrade" && result.service) {
      await notifyUserEvent({
        userId: result.user.id,
        event: "service_renewed",
        title: "Upgrade VPS berhasil",
        body: `VPS ${result.service.hostname} sekarang memakai paket ${result.planName ?? "baru"}.`,
        link: `/dashboard/vps/${result.service.id}`,
        emailVars: { hostname: result.service.hostname, link: `/dashboard/vps/${result.service.id}` },
      });
    }
  } catch (error) {
    console.error("[billing] notifikasi pasca pembayaran gagal", error);
  }
}

export async function payInvoiceWithBalance(invoiceId: string, userId: string): Promise<SettleResult> {
  const invoice = ensureInvoice(invoiceId);
  if (invoice.userId !== userId) throw new BillingError("FORBIDDEN", "Invoice bukan milik kamu.");
  if (invoice.type === "topup") {
    throw new BillingError("INVALID_METHOD", "Top up tidak bisa dibayar dengan saldo.");
  }
  return settleInvoice({
    invoiceId,
    provider: "balance",
    providerRef: `BAL-${invoice.invoiceNumber}`,
    method: "saldo",
    deductBalance: true,
  });
}

export async function createRenewalInvoice(input: {
  userId: string;
  serviceId: string;
  cycle: keyof typeof CYCLE_MONTHS;
}) {
  const svc = db.select().from(services).where(eq(services.id, input.serviceId)).get();
  if (!svc) throw new BillingError("NOT_FOUND", "VPS tidak ditemukan.");
  if (svc.userId !== input.userId) throw new BillingError("FORBIDDEN", "VPS bukan milik kamu.");
  if (!["active", "suspended"].includes(svc.status)) {
    throw new BillingError("INVALID_STATE", "VPS ini tidak bisa diperpanjang.");
  }
  const plan = db.select().from(plans).where(eq(plans.id, svc.planId)).get();
  if (!plan) throw new BillingError("NOT_FOUND", "Paket tidak ditemukan.");
  const amount = cycleUnitPrice(plan, input.cycle);
  const id = uid("inv_", 16);
  db.insert(invoices)
    .values({
      id,
      invoiceNumber: makeInvoiceNumber(),
      userId: input.userId,
      serviceId: svc.id,
      type: "renewal",
      amount,
      status: "unpaid",
      dueDate: invoiceExpiryDate(),
      metadata: { cycle: input.cycle, hostname: svc.hostname, planName: plan.name },
    })
    .run();
  return { invoice: ensureInvoice(id), plan };
}

export async function createUpgradeInvoice(input: {
  userId: string;
  serviceId: string;
  targetPlanId: number;
}) {
  const svc = db.select().from(services).where(eq(services.id, input.serviceId)).get();
  if (!svc) throw new BillingError("NOT_FOUND", "VPS tidak ditemukan.");
  if (svc.userId !== input.userId) throw new BillingError("FORBIDDEN", "VPS bukan milik kamu.");
  if (svc.status !== "active") throw new BillingError("INVALID_STATE", "VPS harus aktif untuk upgrade.");
  const currentPlan = db.select().from(plans).where(eq(plans.id, svc.planId)).get();
  const target = db.select().from(plans).where(eq(plans.id, input.targetPlanId)).get();
  if (!currentPlan || !target) throw new BillingError("NOT_FOUND", "Paket tidak ditemukan.");
  if (target.priceMonthly <= currentPlan.priceMonthly) {
    throw new BillingError("INVALID_TARGET", "Pilih paket dengan harga lebih tinggi.");
  }
  const amount = upgradeProration({
    currentPrice: currentPlan.priceMonthly,
    targetPrice: target.priceMonthly,
    periodStart: svc.periodStart,
    periodEnd: svc.periodEnd,
  });
  if (amount < 1000) throw new BillingError("TOO_SMALL", "Nilai upgrade terlalu kecil.");
  const id = uid("inv_", 16);
  db.insert(invoices)
    .values({
      id,
      invoiceNumber: makeInvoiceNumber(),
      userId: input.userId,
      serviceId: svc.id,
      type: "upgrade",
      amount,
      status: "unpaid",
      dueDate: invoiceExpiryDate(),
      metadata: {
        targetPlanId: target.id,
        targetPlanName: target.name,
        targetSizeSlug: target.doSizeSlug,
        hostname: svc.hostname,
      },
    })
    .run();
  return { invoice: ensureInvoice(id), currentPlan, target };
}

export async function createTopupInvoice(input: {
  userId: string;
  amount: number;
  method: string;
}) {
  const id = uid("inv_", 16);
  db.insert(invoices)
    .values({
      id,
      invoiceNumber: makeInvoiceNumber(),
      userId: input.userId,
      type: "topup",
      amount: input.amount,
      status: "unpaid",
      dueDate: invoiceExpiryDate(),
      paymentProvider: input.method,
      metadata: { method: input.method },
    })
    .run();
  return ensureInvoice(id);
}

export function getInvoiceByNumber(number: string) {
  return db.select().from(invoices).where(eq(invoices.invoiceNumber, number)).get();
}

export function getInvoiceForUser(id: string, userId: string) {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
    .get();
}

export function countUnpaidInvoices(userId: string): number {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, userId), eq(invoices.status, "unpaid")))
    .all().length;
}

export function manualBankDetails() {
  const s = getSettings();
  return {
    bank: s.manual_bank_name,
    accountNumber: s.manual_account_number,
    accountName: s.manual_account_name,
    instructions: s.manual_instructions,
  };
}
