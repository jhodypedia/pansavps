import "server-only";

import { and, eq, lte } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  balanceTransactions,
  invoices,
  jobs,
  osImages,
  orders,
  plans,
  promoCodes,
  regions,
  services,
  sshKeys,
  users,
  type BillingCycle,
  type PromoCode,
} from "@/lib/db/schema";
import { buildPriceSnapshot, calculateDiscount, priceBreakdown, CYCLE_MONTHS } from "@/lib/pricing";
import {
  formatDateTime,
  formatIDR,
  invoiceNumber as makeInvoiceNumber,
  orderNumber as makeOrderNumber,
  uid,
} from "@/lib/format";
import { INVOICE_EXPIRY_MINUTES, invoiceExpiryDate } from "@/lib/invoices";
import { notifyAdmins, notifyUserEvent } from "@/lib/notifications";
import type { OrderInput } from "@/lib/validators";
import { deleteDroplet } from "@/lib/digitalocean";

export class OrderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OrderError";
    this.code = code;
  }
}

export function resolvePromo(code: string, subtotal: number): PromoCode {
  if (!code) throw new OrderError("PROMO_INVALID", "Masukkan kode promo.");
  const now = new Date();
  const promo = db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, code.trim().toUpperCase()))
    .get();
  if (!promo || !promo.isActive) throw new OrderError("PROMO_INVALID", "Kode promo tidak ditemukan atau tidak aktif.");
  if (promo.startsAt && promo.startsAt > now) throw new OrderError("PROMO_NOT_STARTED", "Kode promo belum dapat digunakan.");
  if (promo.endsAt && promo.endsAt < now) throw new OrderError("PROMO_EXPIRED", "Kode promo sudah kedaluwarsa.");
  if (promo.quota !== null && promo.usedCount >= promo.quota) {
    throw new OrderError("PROMO_QUOTA", "Kuota kode promo sudah habis.");
  }
  if (subtotal < promo.minAmount) {
    throw new OrderError(
      "PROMO_MIN",
      `Kode promo berlaku untuk transaksi minimal ${formatIDR(promo.minAmount)}.`,
    );
  }
  return promo;
}

export function validatePromoPreview(input: { code: string; planId: number; cycle: BillingCycle }) {
  const plan = db.select().from(plans).where(eq(plans.id, input.planId)).get();
  if (!plan) return { ok: false as const, message: "Paket tidak ditemukan." };
  if (!input.code.trim()) return { ok: false as const, message: "Masukkan kode promo." };
  try {
    const base = priceBreakdown(plan, input.cycle, { includeSetup: false });
    const promo = resolvePromo(input.code, base.subtotal);
    const discount = calculateDiscount(promo, base.subtotal);
    return {
      ok: true as const,
      code: promo.code,
      discount,
      total: Math.max(0, base.subtotal + plan.setupFee - discount),
      message: `Kode ${promo.code} berhasil dipakai. Hemat ${formatIDR(discount)}.`,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Kode promo tidak valid.",
    };
  }
}

export function sshFingerprint(publicKey: string): string {
  try {
    const parts = publicKey.trim().split(/\s+/);
    const blob = Buffer.from(parts[1] ?? "", "base64");
    const hash = crypto.createHash("sha256").update(blob).digest("base64").replace(/=+$/, "");
    return `SHA256:${hash}`;
  } catch {
    return "SHA256:tidak-diketahui";
  }
}

function resolveSshKey(userId: string, input: OrderInput): string | null {
  if (input.sshMode === "password") return null;
  if (input.sshMode === "existing") {
    if (!input.sshKeyId) throw new OrderError("SSH_REQUIRED", "Pilih SSH key yang akan dipakai.");
    const key = db
      .select()
      .from(sshKeys)
      .where(and(eq(sshKeys.id, input.sshKeyId), eq(sshKeys.userId, userId)))
      .get();
    if (!key) throw new OrderError("SSH_NOT_FOUND", "SSH key tidak ditemukan.");
    return key.id;
  }
  if (!input.newSshKeyName || !input.newSshKeyPublic) {
    throw new OrderError("SSH_INVALID", "Lengkapi nama dan public key SSH.");
  }
  if (!/^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256)\s+[A-Za-z0-9+/=]+/.test(input.newSshKeyPublic.trim())) {
    throw new OrderError("SSH_INVALID", "Format public key tidak valid.");
  }
  const id = uid("ssh_", 16);
  db.insert(sshKeys)
    .values({
      id,
      userId,
      name: input.newSshKeyName.trim(),
      publicKey: input.newSshKeyPublic.trim(),
      fingerprint: sshFingerprint(input.newSshKeyPublic),
    })
    .run();
  return id;
}

export async function createOrder(input: OrderInput, userId: string) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new OrderError("NOT_FOUND", "User tidak ditemukan.");
  if (user.status !== "active") throw new OrderError("SUSPENDED", "Akun kamu sedang ditangguhkan.");
  if (!user.phone) {
    throw new OrderError(
      "PHONE_REQUIRED",
      "Lengkapi nomor WhatsApp di Pengaturan Akun sebelum memesan VPS.",
    );
  }

  const plan = db.select().from(plans).where(eq(plans.id, input.planId)).get();
  if (!plan || !plan.isActive) throw new OrderError("PLAN_INACTIVE", "Paket tidak tersedia.");
  if (!plan.allowRegionSlugs.includes(input.regionSlug)) {
    throw new OrderError("REGION_INVALID", "Region tidak tersedia untuk paket ini.");
  }
  const region = db.select().from(regions).where(eq(regions.slug, input.regionSlug)).get();
  if (!region || !region.isActive || !region.available) {
    throw new OrderError("REGION_INACTIVE", "Region sedang tidak tersedia.");
  }
  const image = db.select().from(osImages).where(eq(osImages.slug, input.osSlug)).get();
  if (!image || !image.isActive) throw new OrderError("OS_INACTIVE", "Sistem operasi tidak tersedia.");

  if (!["balance", "manual", "tripay"].includes(input.paymentMethod)) {
    throw new OrderError("PAYMENT_INVALID", "Metode pembayaran tidak valid.");
  }

  const baseBreakdown = priceBreakdown(plan, input.billingCycle, { includeSetup: false });
  const promo = input.promoCode ? resolvePromo(input.promoCode, baseBreakdown.subtotal) : null;
  const snapshot = buildPriceSnapshot(plan, input.billingCycle, promo);
  const sshKeyId = resolveSshKey(userId, input);

  const expiresAt = invoiceExpiryDate();
  const orderId = uid("ord_", 16);
  const invoiceId = uid("inv_", 16);
  const number = makeOrderNumber();
  const invNumber = makeInvoiceNumber();

  db.transaction((tx) => {
    tx.insert(orders)
      .values({
        id: orderId,
        orderNumber: number,
        userId,
        planId: plan.id,
        regionSlug: input.regionSlug,
        osSlug: input.osSlug,
        hostname: input.hostname.toLowerCase(),
        billingCycle: input.billingCycle,
        priceSnapshot: snapshot,
        promoCodeId: promo?.id ?? null,
        sshKeyId,
        status: "pending_payment",
        expiresAt,
      })
      .run();
    tx.insert(invoices)
      .values({
        id: invoiceId,
        invoiceNumber: invNumber,
        userId,
        orderId,
        type: "new",
        amount: snapshot.total,
        status: "unpaid",
        dueDate: expiresAt,
        paymentProvider: input.paymentMethod,
        metadata: {
          planName: plan.name,
          hostname: input.hostname.toLowerCase(),
          cycle: input.billingCycle,
        },
      })
      .run();
    if (promo) {
      tx.update(promoCodes)
        .set({ usedCount: promo.usedCount + 1 })
        .where(eq(promoCodes.id, promo.id))
        .run();
    }
  });

  const order = db.select().from(orders).where(eq(orders.id, orderId)).get()!;
  const invoice = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get()!;

  await notifyUserEvent({
    userId,
    event: "order_created",
    title: "Pesanan dibuat",
    body: `Pesanan ${number} untuk ${plan.name} menunggu pembayaran sebelum ${formatDateTime(expiresAt)}.`,
    link: `/dashboard/pesanan/${orderId}`,
    emailVars: {
      order_number: number,
      nama_paket: plan.name,
      total: formatIDR(snapshot.total),
      jatuh_tempo: formatDateTime(expiresAt),
      link: `/dashboard/pesanan/${orderId}`,
    },
    waPayload: {
      order_number: number,
      nama_paket: plan.name,
      total: formatIDR(snapshot.total),
      jatuh_tempo: formatDateTime(expiresAt),
      link: `/dashboard/pesanan/${orderId}`,
    },
  });

  await notifyAdmins({
    type: "order_created",
    title: "Pesanan baru",
    body: `${user.name} memesan ${plan.name} (${number}).`,
    link: `/admin/orders/${orderId}`,
    waEvent: "order_created",
    waMessage: `Order baru: ${number}\nPaket: ${plan.name}\nTotal: ${formatIDR(snapshot.total)}\nUser: ${user.name}`,
  });

  return { order, invoice, plan };
}

export function getOrderForUser(orderId: string, userId: string) {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .get();
}

export function provisioningTimeline(orderStatus: string, jobStep: number | null, serviceStatus?: string | null) {
  const steps = [
    { key: "payment", label: "Menunggu Pembayaran", done: false, active: false },
    { key: "create", label: "Membuat Server", done: false, active: false },
    { key: "setup", label: "Menyiapkan Sistem", done: false, active: false },
    { key: "active", label: "Aktif", done: false, active: false },
  ];
  if (["paid", "provisioning", "active"].includes(orderStatus)) steps[0].done = true;
  if (orderStatus === "provisioning") {
    if (jobStep === null || jobStep === 0) {
      steps[1].active = true;
    } else {
      steps[1].done = true;
      steps[2].active = true;
    }
  }
  if (orderStatus === "active" || serviceStatus === "active") {
    steps[0].done = true;
    steps[1].done = true;
    steps[2].done = true;
    steps[3].active = true;
  }
  if (["failed", "cancelled", "expired"].includes(orderStatus)) {
    steps.forEach((s) => {
      s.active = false;
    });
  }
  return steps;
}

export async function expireInvoices() {
  const cutoff = new Date(Date.now() - INVOICE_EXPIRY_MINUTES * 60_000);
  const stale = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.status, "unpaid"), lte(invoices.createdAt, cutoff)))
    .all();
  let count = 0;
  for (const invoice of stale) {
    db.update(invoices).set({ status: "expired" }).where(eq(invoices.id, invoice.id)).run();
    if (invoice.orderId) {
      const order = db.select().from(orders).where(eq(orders.id, invoice.orderId)).get();
      if (order?.status === "pending_payment") {
        db.update(orders).set({ status: "expired" }).where(eq(orders.id, order.id)).run();
      }
    }
    count++;
  }
  return count;
}

export type RefundOrderOptions = {
  reason?: string;
  notify?: boolean;
};

export async function refundOrder(
  orderId: string,
  actorId: string,
  note: string,
  options: RefundOrderOptions = {},
) {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) throw new OrderError("NOT_FOUND", "Order tidak ditemukan.");

  const user = db.select().from(users).where(eq(users.id, order.userId)).get();
  if (!user) throw new OrderError("NOT_FOUND", "User tidak ditemukan.");

  // Idempotensi: jangan pernah mengkredit saldo dua kali untuk order yang sama.
  const existingRefund = db
    .select()
    .from(balanceTransactions)
    .where(and(eq(balanceTransactions.ref, order.id), eq(balanceTransactions.type, "refund")))
    .get();
  if (existingRefund) {
    return {
      amount: existingRefund.amount,
      balance: user.balance,
      alreadyRefunded: true,
    };
  }

  const invoice = db.select().from(invoices).where(eq(invoices.orderId, order.id)).get();
  if (!invoice || invoice.status !== "paid") {
    throw new OrderError(
      "NOT_PAID",
      "Refund hanya dapat diproses untuk pesanan yang pembayarannya sudah diterima.",
    );
  }

  const svc = db.select().from(services).where(eq(services.orderId, order.id)).get();
  if (svc?.doDropletId && svc.status !== "terminated") {
    try {
      await deleteDroplet(svc.doDropletId, svc.doAccountId);
    } catch (error) {
      console.error("[refund] gagal menghapus droplet", error);
    }
  }

  const amount = order.priceSnapshot.total;
  const newBalance = user.balance + amount;
  const orderPatch: { status: "cancelled"; errorMessage?: string } = { status: "cancelled" };
  if (!order.errorMessage && options.reason?.trim()) {
    orderPatch.errorMessage = options.reason.trim().slice(0, 300);
  }
  db.transaction((tx) => {
    tx.update(users)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .run();
    tx.insert(balanceTransactions)
      .values({
        id: uid("bt_", 16),
        userId: user.id,
        type: "refund",
        amount,
        balanceAfter: newBalance,
        ref: order.id,
        note,
        createdBy: actorId,
      })
      .run();
    tx.update(orders).set(orderPatch).where(eq(orders.id, order.id)).run();
    tx.update(invoices)
      .set({ status: "refunded" })
      .where(eq(invoices.id, invoice.id))
      .run();
    if (svc) {
      tx.update(services)
        .set({ status: "terminated", terminatedAt: new Date() })
        .where(eq(services.id, svc.id))
        .run();
    }
  });

  if (options.notify !== false) {
    const reason = options.reason?.trim();
    await notifyUserEvent({
      userId: user.id,
      event: "refund_processed",
      title: "Refund ke saldo",
      body: `Dana ${formatIDR(amount)} untuk pesanan ${order.orderNumber} sudah dikembalikan ke saldo.${
        reason ? ` Alasan: ${reason}` : ""
      }`,
      link: "/dashboard/saldo",
      emailVars: {
        order_number: order.orderNumber,
        total: formatIDR(amount),
        saldo: formatIDR(newBalance),
        alasan: reason || "Refund pesanan",
        link: "/dashboard/saldo",
      },
      waPayload: {
        order_number: order.orderNumber,
        total: formatIDR(amount),
        saldo: formatIDR(newBalance),
        alasan: reason || "Refund pesanan",
        link: "/dashboard/saldo",
      },
    });
  }

  return { amount, balance: newBalance, alreadyRefunded: false };
}

export async function retryProvisioning(orderId: string) {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) throw new OrderError("NOT_FOUND", "Order tidak ditemukan.");
  const refunded = db
    .select()
    .from(balanceTransactions)
    .where(and(eq(balanceTransactions.ref, order.id), eq(balanceTransactions.type, "refund")))
    .get();
  if (refunded) {
    throw new OrderError(
      "REFUNDED",
      "Pesanan ini sudah direfund ke saldo. Buat pesanan baru untuk mencoba lagi.",
    );
  }
  const svc = db.select().from(services).where(eq(services.orderId, order.id)).get();
  if (!svc) throw new OrderError("NO_SERVICE", "Layanan untuk order ini tidak ditemukan.");
  db.transaction((tx) => {
    tx.update(services).set({ status: "provisioning" }).where(eq(services.id, svc.id)).run();
    tx.update(orders)
      .set({ status: "provisioning", errorMessage: null })
      .where(eq(orders.id, order.id))
      .run();
    tx.insert(jobs)
      .values({
        id: uid("job_", 16),
        type: "provision_service",
        refId: svc.id,
        status: "queued",
        step: 0,
        attempts: 0,
        notBefore: new Date(),
        payload: { orderId: order.id, retry: true },
        updatedAt: new Date(),
      })
      .run();
  });
  return true;
}

export function activePlans() {
  return db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function planById(id: number) {
  return db.select().from(plans).where(eq(plans.id, id)).get();
}

export function cycleMonths(cycle: BillingCycle) {
  return CYCLE_MONTHS[cycle];
}
