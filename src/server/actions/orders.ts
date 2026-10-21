"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  invoices,
  orders,
  payments,
  tickets,
  users,
  type Invoice,
} from "@/lib/db/schema";
import { getSessionUser, isUserVerified } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { uid, ticketNumber } from "@/lib/format";
import { formatIDR } from "@/lib/format";
import {
  createOrder,
  validatePromoPreview,
  retryProvisioning,
} from "@/server/services/orders";
import {
  BillingError,
  createRenewalInvoice,
  createTopupInvoice,
  createUpgradeInvoice,
  payInvoiceWithBalance,
} from "@/server/services/billing";
import { createGatewayPayment } from "@/lib/payments";
import { isProviderEnabled } from "@/lib/payments";
import { resizeServiceForUpgrade } from "@/server/services/services";
import { notifyAdmins } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import {
  manualProofSchema,
  orderSchema,
  renewSchema,
  topupSchema,
  upgradeSchema,
} from "@/lib/validators";
import type { ActionResult } from "./types";
import { done, errorMessage, fail, fromZod } from "./utils";

type GatewayMethod = "tripay";

const VERIFICATION_REQUIRED =
  "Verifikasi akun diperlukan sebelum melakukan pembelian. Verifikasi via kode WhatsApp atau tautan email terlebih dahulu.";

function verificationRequired<T = unknown>(): ActionResult<T> {
  return fail<T>(VERIFICATION_REQUIRED);
}

function isInsufficientBalance(error: unknown): boolean {
  return error instanceof BillingError && error.code === "INSUFFICIENT_BALANCE";
}

async function startGatewayPayment(
  invoice: Invoice,
  method: GatewayMethod,
  channel?: string,
): Promise<ActionResult<{ redirectUrl?: string; qrString?: string }>> {
  if (!isProviderEnabled(method)) {
    return fail("Metode pembayaran ini sedang tidak tersedia.", undefined, true);
  }
  const user = db.select().from(users).where(eq(users.id, invoice.userId)).get();
  if (!user) return fail("Pemilik invoice tidak ditemukan.", undefined, true);
  try {
    const intent = await createGatewayPayment(
      invoice,
      method,
      {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      channel,
    );
    const providerRef = intent.reference ?? invoice.invoiceNumber;
    const gateway = intent.gateway
      ? {
          provider: "tripay",
          reference: providerRef,
          subtotal: intent.gateway.subtotal,
          amountReceived: intent.gateway.subtotal,
          feeCustomer: intent.gateway.feeCustomer,
          feeMerchant: intent.gateway.feeMerchant,
          total: intent.gateway.total,
          amount: intent.gateway.total,
          method: intent.channel ?? channel ?? method,
          paymentName: intent.channel ?? channel ?? method,
          status: "PENDING",
          createdAt: Date.now(),
        }
      : null;
    db.insert(payments)
      .values({
        id: uid("pay_", 16),
        invoiceId: invoice.id,
        provider: method,
        providerRef,
        method: intent.channel ?? channel ?? method,
        amount: invoice.amount,
        status: "pending",
        rawWebhook: gateway ? { source: "create", gateway } : null,
        updatedAt: new Date(),
      })
      .run();
    db.update(invoices)
      .set({
        paymentProvider: method,
        paymentRef: providerRef,
        ...(gateway
          ? { metadata: { ...(invoice.metadata ?? {}), tripay: gateway } }
          : {}),
      })
      .where(eq(invoices.id, invoice.id))
      .run();
    return done("Transaksi pembayaran dibuat.", {
      data: { redirectUrl: intent.redirectUrl, qrString: intent.qrString },
      ...(intent.redirectUrl ? { redirectTo: intent.redirectUrl } : {}),
    });
  } catch (error) {
    // Detail kegagalan gateway hanya untuk log server. Pengguna Tripay tidak
    // perlu melihat alert/toast teknis saat transaksi gagal dibuat.
    console.error("[payments] gagal membuat transaksi Tripay", error);
    return fail("Transaksi pembayaran belum dapat dibuat. Silakan coba lagi.", undefined, true);
  }
}

export async function createOrderAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
  if (!isUserVerified(user)) return verificationRequired();

  const limit = rateLimit(`order:${user.id}`, 6, 10 * 60 * 1000);
  if (!limit.ok) return fail("Terlalu banyak pesanan dalam waktu singkat. Coba lagi beberapa menit lagi.");

  const parsed = orderSchema.safeParse({
    planId: formData.get("planId"),
    regionSlug: formData.get("regionSlug"),
    osSlug: formData.get("osSlug"),
    hostname: formData.get("hostname"),
    billingCycle: formData.get("billingCycle"),
    promoCode: formData.get("promoCode") || "",
    paymentMethod: formData.get("paymentMethod"),
    paymentChannel: formData.get("paymentChannel") || undefined,
    sshMode: formData.get("sshMode") || "password",
    sshKeyId: formData.get("sshKeyId") || undefined,
    newSshKeyName: formData.get("newSshKeyName") || undefined,
    newSshKeyPublic: formData.get("newSshKeyPublic") || undefined,
  });
  if (!parsed.success) return fromZod(parsed.error);
  if (
    parsed.data.paymentMethod !== "balance" &&
    !isProviderEnabled(parsed.data.paymentMethod)
  ) {
    return fail("Metode pembayaran tidak tersedia. Pilih metode lain.", {
      paymentMethod: ["Metode pembayaran tidak tersedia."],
    });
  }

  try {
    const result = await createOrder(parsed.data, user.id);
    const invoice = result.invoice;
    const redirect = `/dashboard/invoices/${invoice.id}?baru=1`;

    if (parsed.data.paymentMethod === "balance") {
      try {
        await payInvoiceWithBalance(invoice.id, user.id);
      } catch (error) {
        if (isInsufficientBalance(error)) {
          return done(
            "Saldo tidak cukup. Pesanan sudah dibuat, silakan bayar langsung tanpa top up.",
            { redirectTo: redirect },
          );
        }
        throw error;
      }
      revalidatePath("/dashboard");
      return done("Pesanan dibuat dan dibayar dengan saldo. Server sedang disiapkan.", {
        redirectTo: `/dashboard/pesanan/${result.order.id}?dibayar=1`,
      });
    }
    if (parsed.data.paymentMethod === "manual") {
      return done("Pesanan dibuat. Selesaikan pembayaran transfer.", { redirectTo: redirect });
    }
    const gateway = await startGatewayPayment(
      invoice,
      parsed.data.paymentMethod as GatewayMethod,
      parsed.data.paymentChannel,
    );
    if (!gateway.ok) {
      return done("Pesanan dibuat.", { redirectTo: redirect, silent: true });
    }
    return done("Pesanan dibuat. Lanjutkan pembayaran.", {
      redirectTo: gateway.data?.redirectUrl ?? redirect,
      data: { external: Boolean(gateway.data?.redirectUrl) },
      silent: true,
    });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function validatePromoAction(input: {
  code: string;
  planId: number;
  cycle: "monthly" | "quarterly" | "yearly";
}): Promise<ActionResult<{ discount: number; total: number }>> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const limit = rateLimit(`promo:${user.id}`, 15, 10 * 60 * 1000);
  if (!limit.ok) return fail("Terlalu banyak percobaan kode promo.");
  const result = validatePromoPreview(input);
  if (!result.ok) return fail(result.message);
  return done(result.message, { data: { discount: result.discount, total: result.total } });
}

export async function payInvoiceAction(
  invoiceId: string,
  method: "balance" | GatewayMethod,
  channel?: string,
): Promise<ActionResult<{ redirectUrl?: string; qrString?: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  if (!isUserVerified(user)) return verificationRequired();
  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, user.id)))
    .get();
  if (!invoice) return fail("Invoice tidak ditemukan.");
  if (invoice.status !== "unpaid") return fail("Invoice ini sudah tidak dapat dibayar.");

  try {
    if (method === "balance") {
      await payInvoiceWithBalance(invoiceId, user.id);
      revalidatePath("/dashboard/invoices");
      revalidatePath("/dashboard/saldo");
      revalidatePath("/dashboard");
      const order = invoice.orderId
        ? db.select().from(orders).where(eq(orders.id, invoice.orderId)).get()
        : null;
      return done("Pembayaran dengan saldo berhasil.", {
        redirectTo: order ? `/dashboard/pesanan/${order.id}?dibayar=1` : `/dashboard/invoices/${invoiceId}`,
      });
    }
    return startGatewayPayment(invoice, method, channel);
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function createTopupAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ redirectUrl?: string; external?: boolean }>> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  if (!isUserVerified(user)) return verificationRequired();
  const parsed = topupSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    paymentChannel: formData.get("paymentChannel") || undefined,
  });
  if (!parsed.success) return fromZod(parsed.error);
  if (!isProviderEnabled(parsed.data.method)) return fail("Metode pembayaran tidak tersedia.");

  try {
    const invoice = await createTopupInvoice({
      userId: user.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
    });
    if (parsed.data.method === "manual") {
      return done("Invoice top up dibuat. Selesaikan transfer.", {
        redirectTo: `/dashboard/invoices/${invoice.id}?baru=1`,
      });
    }
    const gateway = await startGatewayPayment(
      invoice,
      parsed.data.method,
      parsed.data.paymentChannel,
    );
    if (!gateway.ok) return gateway;
    return done("Transaksi top up dibuat.", {
      redirectTo: gateway.data?.redirectUrl ?? `/dashboard/invoices/${invoice.id}`,
      data: { external: Boolean(gateway.data?.redirectUrl) },
      silent: true,
    });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function renewServiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  if (!isUserVerified(user)) return verificationRequired();
  const parsed = renewSchema.safeParse({
    serviceId: formData.get("serviceId"),
    cycle: formData.get("cycle"),
    paymentMethod: formData.get("paymentMethod"),
    paymentChannel: formData.get("paymentChannel") || undefined,
  });
  if (!parsed.success) return fromZod(parsed.error);
  if (
    parsed.data.paymentMethod !== "balance" &&
    !isProviderEnabled(parsed.data.paymentMethod)
  ) {
    return fail("Metode pembayaran tidak tersedia.");
  }

  try {
    const { invoice } = await createRenewalInvoice({
      userId: user.id,
      serviceId: parsed.data.serviceId,
      cycle: parsed.data.cycle,
    });
    if (parsed.data.paymentMethod === "balance") {
      try {
        await payInvoiceWithBalance(invoice.id, user.id);
      } catch (error) {
        if (isInsufficientBalance(error)) {
          return done(
            "Saldo tidak cukup. Invoice perpanjangan sudah dibuat, silakan bayar langsung tanpa top up.",
            { redirectTo: `/dashboard/invoices/${invoice.id}?baru=1` },
          );
        }
        throw error;
      }
      return done("Perpanjangan dibayar dengan saldo.", {
        redirectTo: `/dashboard/vps/${parsed.data.serviceId}?diperpanjang=1`,
      });
    }
    if (parsed.data.paymentMethod === "manual") {
      return done("Invoice perpanjangan dibuat.", {
        redirectTo: `/dashboard/invoices/${invoice.id}?baru=1`,
      });
    }
    const gateway = await startGatewayPayment(
      invoice,
      parsed.data.paymentMethod,
      parsed.data.paymentChannel,
    );
    if (!gateway.ok) return gateway;
    return done("Transaksi perpanjangan dibuat.", {
      redirectTo: gateway.data?.redirectUrl ?? `/dashboard/invoices/${invoice.id}`,
      silent: true,
    });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function upgradeServiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  if (!isUserVerified(user)) return verificationRequired();
  const parsed = upgradeSchema.safeParse({
    serviceId: formData.get("serviceId"),
    targetPlanId: formData.get("targetPlanId"),
    paymentMethod: formData.get("paymentMethod"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  if (
    parsed.data.paymentMethod !== "balance" &&
    !isProviderEnabled(parsed.data.paymentMethod)
  ) {
    return fail("Metode pembayaran tidak tersedia.");
  }

  try {
    const { invoice } = await createUpgradeInvoice({
      userId: user.id,
      serviceId: parsed.data.serviceId,
      targetPlanId: parsed.data.targetPlanId,
    });
    if (parsed.data.paymentMethod === "balance") {
      let result: Awaited<ReturnType<typeof payInvoiceWithBalance>>;
      try {
        result = await payInvoiceWithBalance(invoice.id, user.id);
      } catch (error) {
        if (isInsufficientBalance(error)) {
          return done(
            "Saldo tidak cukup. Invoice upgrade sudah dibuat, silakan bayar langsung tanpa top up.",
            { redirectTo: `/dashboard/invoices/${invoice.id}?baru=1` },
          );
        }
        throw error;
      }
      if (result.resize) await resizeServiceForUpgrade(result.resize.serviceId, result.resize.sizeSlug);
      return done("Upgrade berhasil dibayar dengan saldo.", {
        redirectTo: `/dashboard/vps/${parsed.data.serviceId}?upgrade=1`,
      });
    }
    return done("Invoice upgrade dibuat.", {
      redirectTo: `/dashboard/invoices/${invoice.id}?baru=1`,
    });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const order = db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, user.id)))
    .get();
  if (!order) return fail("Pesanan tidak ditemukan.");
  if (order.status !== "pending_payment") return fail("Pesanan ini tidak bisa dibatalkan.");
  db.transaction((tx) => {
    tx.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id)).run();
    const inv = tx.select().from(invoices).where(eq(invoices.orderId, order.id)).get();
    if (inv && inv.status === "unpaid") {
      tx.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, inv.id)).run();
    }
  });
  await writeAudit({ actor: user, action: "cancel_order", entity: "order", entityId: order.id });
  revalidatePath("/dashboard/pesanan");
  revalidatePath(`/dashboard/pesanan/${order.id}`);
  return done("Pesanan dibatalkan.");
}

export async function retryProvisioningAction(orderId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const order = db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, user.id)))
    .get();
  if (!order) return fail("Pesanan tidak ditemukan.");
  if (order.status !== "failed") return fail("Hanya pesanan gagal yang bisa dicoba ulang.");
  try {
    await retryProvisioning(order.id);
    revalidatePath(`/dashboard/pesanan/${order.id}`);
    return done("Provisioning dijadwalkan ulang. Server akan disiapkan kembali.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function requestRefundAction(orderId: string, reason: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const order = db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, user.id)))
    .get();
  if (!order) return fail("Pesanan tidak ditemukan.");
  if (!["failed", "cancelled", "expired"].includes(order.status)) {
    return fail("Refund hanya dapat diminta untuk pesanan gagal atau batal.");
  }
  if (reason.trim().length < 10) return fail("Tulis alasan refund minimal 10 karakter.");
  const ticketId = uid("tkt_", 16);
  db.insert(tickets)
    .values({
      id: ticketId,
      ticketNumber: ticketNumber(),
      userId: user.id,
      subject: `Permintaan refund ${order.orderNumber}`,
      department: "billing",
      priority: "high",
      status: "open",
      internalNote: `Order ${order.id} · ${formatIDR(order.priceSnapshot.total)}`,
    })
    .run();
  const { ticketReplies } = await import("@/lib/db/schema");
  db.insert(ticketReplies)
    .values({
      id: uid("trp_", 16),
      ticketId,
      userId: user.id,
      authorRole: "user",
      body: reason.trim(),
    })
    .run();
  await notifyAdmins({
    type: "ticket_created",
    title: "Permintaan refund",
    body: `${user.name} meminta refund untuk ${order.orderNumber}.`,
    link: `/admin/tickets/${ticketId}`,
    waEvent: "ticket_created",
    waMessage: `Permintaan refund: ${order.orderNumber}\nUser: ${user.name}\nAlasan: ${reason.slice(0, 200)}`,
  });
  revalidatePath("/dashboard/tiket");
  return done("Permintaan refund dikirim ke tim billing. Kami akan menghubungimu.", {
    redirectTo: `/dashboard/tiket/${ticketId}`,
  });
}

export async function uploadPaymentProofAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  if (!isUserVerified(user)) return verificationRequired();
  const parsed = manualProofSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    senderName: formData.get("senderName"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fromZod(parsed.error);

  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, parsed.data.invoiceId), eq(invoices.userId, user.id)))
    .get();
  if (!invoice) return fail("Invoice tidak ditemukan.");
  if (invoice.status !== "unpaid") return fail("Invoice ini sudah tidak dapat dibayar.");
  if (invoice.type === "topup" && invoice.paymentProvider !== "manual") {
    return fail("Invoice top up ini bukan transfer manual.");
  }

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Unggah bukti transfer terlebih dahulu.", { proof: ["File bukti wajib diunggah."] });
  }
  if (file.size > 5 * 1024 * 1024) {
    return fail("Ukuran file maksimal 5 MB.", { proof: ["Ukuran file maksimal 5 MB."] });
  }
  const allowed: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  const ext = allowed[file.type];
  if (!ext) return fail("Format file harus PNG, JPG, WEBP, atau PDF.");

  const rel = `proofs/${uid("prf_", 20)}.${ext}`;
  const abs = path.join(process.cwd(), "data", "uploads", rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()));

  const existing = db
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoice.id), eq(payments.status, "pending")))
    .get();
  if (existing) {
    db.update(payments)
      .set({
        proofUrl: rel,
        provider: "manual",
        method: "manual",
        rawWebhook: { senderName: parsed.data.senderName, note: parsed.data.note ?? null },
        updatedAt: new Date(),
      })
      .where(eq(payments.id, existing.id))
      .run();
  } else {
    db.insert(payments)
      .values({
        id: uid("pay_", 16),
        invoiceId: invoice.id,
        provider: "manual",
        providerRef: invoice.invoiceNumber,
        method: "manual",
        amount: invoice.amount,
        status: "pending",
        proofUrl: rel,
        rawWebhook: { senderName: parsed.data.senderName, note: parsed.data.note ?? null },
        updatedAt: new Date(),
      })
      .run();
  }
  db.update(invoices)
    .set({ paymentProvider: "manual", paymentRef: invoice.invoiceNumber })
    .where(eq(invoices.id, invoice.id))
    .run();

  await notifyAdmins({
    type: "payment_proof",
    title: "Bukti transfer baru",
    body: `${user.name} mengunggah bukti untuk ${invoice.invoiceNumber} (${formatIDR(invoice.amount)}).`,
    link: `/admin/payments`,
    waEvent: "topup_pending",
    waMessage: `Bukti transfer baru: ${invoice.invoiceNumber}\nUser: ${user.name}\nNominal: ${formatIDR(invoice.amount)}`,
  });
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  revalidatePath("/admin/payments");
  return done("Bukti transfer terkirim. Admin akan memverifikasi maksimal 1x24 jam.");
}
