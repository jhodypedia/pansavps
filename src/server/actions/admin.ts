"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  balanceTransactions,
  invoices,
  payments,
  planPriceHistory,
  plans,
  promoCodes,
  services,
  settings,
  users,
  waTemplates,
  waState,
} from "@/lib/db/schema";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { randomPassword, maskSecret } from "@/lib/crypto";
import { sendEmail, getTestEmailBody } from "@/lib/email";
import { notifyUserEvent } from "@/lib/notifications";
import { formatIDR, uid } from "@/lib/format";
import { marginInfo, priceFromMarkup } from "@/lib/pricing";
import { getSettings, setSettings, ENCRYPTED_SETTING_KEYS } from "@/lib/settings";
import { queueWhatsApp } from "@/lib/whatsapp/queue";
import { testConnection as testDoConnection } from "@/lib/digitalocean";
import {
  createDoAccount,
  deleteDoAccount,
  getDoAccountById,
  setDefaultDoAccount,
  updateDoAccount,
} from "@/lib/do-accounts";
import { runCron } from "@/server/services/cron";
import { syncDigitalOceanServices } from "@/server/services/do-services";
import type { DoServiceSyncResult } from "@/lib/do-sync";
import { autoCyclePrices, recalculateAutoPlanPrices, syncDoCatalog } from "@/server/services/do-catalog";
import { settleInvoice } from "@/server/services/billing";
import { refundOrder, retryProvisioning } from "@/server/services/orders";
import {
  adjustBalanceSchema,
  announcementSchema,
  doAccountSchema,
  doSettingsSchema,
  emailSettingsSchema,
  generalSettingsSchema,
  notificationSettingsSchema,
  paymentSettingsSchema,
  planSchema,
  pricingSettingsSchema,
  promoCodeSchema,
  userActionSchema,
  verifyManualPaymentSchema,
} from "@/lib/validators";
import type { ActionResult } from "./types";
import { done, errorMessage, fail, formBool, formString, fromZod } from "./utils";

async function requireAdminAction(): Promise<Awaited<ReturnType<typeof getSessionUser>>> {
  const user = await getSessionUser();
  return user && user.role === "admin" ? user : null;
}

/* ── Paket ─────────────────────────────────────────────────── */
export async function savePlanAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin yang dapat mengubah paket.");
  const idRaw = formString(formData, "id");
  const s = getSettings();
  const rate = Number(s.usd_idr_rate || 16500);
  const markup = Number(s.default_markup_percent || 30);
  const autoPrice = priceFromMarkup(Number(formString(formData, "costMonthlyUsd")) || 0, rate, markup);
  const pricingAuto = formBool(formData, "pricingAuto");
  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || "",
    doSizeSlug: formData.get("doSizeSlug"),
    vcpus: formData.get("vcpus"),
    ramMb: formData.get("ramMb"),
    diskGb: formData.get("diskGb"),
    transferTb: formData.get("transferTb"),
    costMonthlyUsd: formData.get("costMonthlyUsd"),
    priceMonthly: pricingAuto ? autoPrice : formData.get("priceMonthly"),
    priceWeekly: formString(formData, "priceWeekly") || null,
    priceQuarterly: formString(formData, "priceQuarterly") || null,
    priceYearly: formString(formData, "priceYearly") || null,
    promoPriceMonthly: formString(formData, "promoPriceMonthly") || null,
    setupFee: formString(formData, "setupFee") || 0,
    isActive: formBool(formData, "isActive"),
    isFeatured: formBool(formData, "isFeatured"),
    allowRegionSlugs: formData.getAll("allowRegionSlugs").map(String).filter(Boolean),
    sortOrder: formString(formData, "sortOrder") || 0,
    confirmBelowCost: formBool(formData, "confirmBelowCost"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const input = parsed.data;
  if (input.allowRegionSlugs.length === 0) {
    return fail("Pilih minimal satu region.", { allowRegionSlugs: ["Pilih minimal satu region."] });
  }

  const margin = marginInfo({
    priceMonthly: input.priceMonthly,
    costMonthlyUsd: input.costMonthlyUsd,
    usdIdrRate: rate,
  });
  if (margin.belowCost && !input.confirmBelowCost) {
    return fail(
      `Harga jual (${formatIDR(input.priceMonthly)}) di bawah modal (${formatIDR(margin.modal)}). Centang konfirmasi jika tetap ingin menyimpan.`,
    );
  }

  const existing = idRaw
    ? db.select().from(plans).where(eq(plans.id, Number(idRaw))).get()
    : null;
  if (idRaw && !existing) return fail("Paket tidak ditemukan.");
  const slugTaken = db.select().from(plans).where(eq(plans.slug, input.slug)).get();
  if (slugTaken && slugTaken.id !== existing?.id) {
    return fail("Slug paket sudah dipakai.", { slug: ["Slug sudah dipakai paket lain."] });
  }

  const values = {
    name: input.name,
    slug: input.slug,
    description: input.description,
    doSizeSlug: input.doSizeSlug,
    vcpus: input.vcpus,
    ramMb: input.ramMb,
    diskGb: input.diskGb,
    transferTb: input.transferTb,
    costMonthlyUsd: input.costMonthlyUsd,
    priceMonthly: input.priceMonthly,
    priceWeekly: input.priceWeekly ?? null,
    priceQuarterly: pricingAuto ? autoCyclePrices(input.priceMonthly).quarterly : input.priceQuarterly,
    priceYearly: pricingAuto ? autoCyclePrices(input.priceMonthly).yearly : input.priceYearly,
    pricingMode: pricingAuto ? ("auto" as const) : ("custom" as const),
    promoPriceMonthly: input.promoPriceMonthly ?? null,
    setupFee: input.setupFee,
    isActive: input.isActive,
    isFeatured: input.isFeatured,
    allowRegionSlugs: input.allowRegionSlugs,
    sortOrder: input.sortOrder,
    updatedAt: new Date(),
  };

  try {
    if (existing) {
      db.transaction((tx) => {
        tx.update(plans).set(values).where(eq(plans.id, existing.id)).run();
        for (const key of [
          "priceMonthly",
          "priceWeekly",
          "priceQuarterly",
          "priceYearly",
          "promoPriceMonthly",
          "setupFee",
          "costMonthlyUsd",
        ] as const) {
          const oldValue = existing[key];
          const newValue = values[key];
          if (String(oldValue ?? "") !== String(newValue ?? "")) {
            tx.insert(planPriceHistory)
              .values({
                planId: existing.id,
                changedBy: admin.id,
                field: key,
                oldValue: String(oldValue ?? ""),
                newValue: String(newValue ?? ""),
              })
              .run();
          }
        }
      });
      await writeAudit({
        actor: admin,
        action: "update_plan",
        entity: "plan",
        entityId: String(existing.id),
        before: existing as unknown as Record<string, unknown>,
        after: values as unknown as Record<string, unknown>,
      });
    } else {
      const inserted = db.insert(plans).values(values).returning({ id: plans.id }).get();
      await writeAudit({
        actor: admin,
        action: "create_plan",
        entity: "plan",
        entityId: String(inserted?.id ?? ""),
        after: values as unknown as Record<string, unknown>,
      });
    }
    revalidatePath("/admin/plans");
    revalidatePath("/pricing");
    revalidatePath("/");
    return done(existing ? "Paket diperbarui." : "Paket baru dibuat.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function togglePlanAction(planId: number): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!plan) return fail("Paket tidak ditemukan.");
  db.update(plans).set({ isActive: !plan.isActive, updatedAt: new Date() }).where(eq(plans.id, planId)).run();
  await writeAudit({
    actor: admin,
    action: "toggle_plan",
    entity: "plan",
    entityId: String(planId),
    after: { isActive: !plan.isActive },
  });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  revalidatePath("/");
  return done(plan.isActive ? "Paket dinonaktifkan." : "Paket diaktifkan.");
}

export async function deletePlanAction(planId: number): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!plan) return fail("Paket tidak ditemukan.");
  const used = db.select().from(services).where(eq(services.planId, planId)).get();
  if (used) {
    db.update(plans).set({ isActive: false, updatedAt: new Date() }).where(eq(plans.id, planId)).run();
    revalidatePath("/admin/plans");
    revalidatePath("/pricing");
    revalidatePath("/");
    return done("Paket sudah pernah dipakai, jadi hanya dinonaktifkan (bukan dihapus).");
  }
  db.delete(plans).where(eq(plans.id, planId)).run();
  await writeAudit({ actor: admin, action: "delete_plan", entity: "plan", entityId: String(planId) });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  revalidatePath("/");
  return done("Paket dihapus.");
}

export async function suggestPlanPriceAction(costUsd: number): Promise<ActionResult<{ price: number }>> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const s = getSettings();
  const price = priceFromMarkup(
    Number(costUsd) || 0,
    Number(s.usd_idr_rate || 16500),
    Number(s.default_markup_percent || 30),
  );
  return done("Harga saran dihitung.", { data: { price } });
}

export async function syncDoCatalogAction(): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  try {
    const result = await syncDoCatalog();
    await writeAudit({
      actor: admin,
      action: "sync_do_catalog",
      entity: "plan",
      entityId: "digitalocean",
      after: result,
    });
    revalidatePath("/admin/plans");
    revalidatePath("/pricing");
    revalidatePath("/");
    return done(
      `Sinkronisasi selesai: ${result.created} produk baru, ${result.updated} diperbarui, ${result.autoPrices} harga otomatis disesuaikan.`,
      { data: result },
    );
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function recalculatePlanPricesAction(): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const result = recalculateAutoPlanPrices();
  await writeAudit({
    actor: admin,
    action: "recalculate_auto_prices",
    entity: "plan",
    entityId: "auto",
    after: result,
  });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  revalidatePath("/");
  return done(
    result.updated > 0
      ? `${result.updated} harga produk otomatis disesuaikan dengan kurs dan markup terbaru.`
      : "Semua harga otomatis sudah sesuai dengan pengaturan saat ini.",
  );
}

export async function setPlanPricingModeAction(
  planId: number,
  mode: "auto" | "custom",
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!plan) return fail("Paket tidak ditemukan.");
  db.update(plans)
    .set({ pricingMode: mode, updatedAt: new Date() })
    .where(eq(plans.id, planId))
    .run();
  if (mode === "auto") recalculateAutoPlanPrices();
  await writeAudit({
    actor: admin,
    action: "set_plan_pricing_mode",
    entity: "plan",
    entityId: String(planId),
    after: { mode },
  });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  revalidatePath("/");
  return done(
    mode === "auto"
      ? "Harga produk sekarang mengikuti kurs & markup otomatis."
      : "Harga produk disimpan sebagai harga custom.",
  );
}

/* ── Promo ─────────────────────────────────────────────────── */
export async function savePromoAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const idRaw = formString(formData, "id");
  const parsed = promoCodeSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    maxDiscount: formString(formData, "maxDiscount") || null,
    minAmount: formString(formData, "minAmount") || 0,
    quota: formString(formData, "quota") || null,
    startsAt: formString(formData, "startsAt") || undefined,
    endsAt: formString(formData, "endsAt") || undefined,
    isActive: formBool(formData, "isActive"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  if (parsed.data.type === "percent" && parsed.data.value > 100) {
    return fail("Diskon persen maksimal 100%.");
  }
  const existing = idRaw
    ? db.select().from(promoCodes).where(eq(promoCodes.id, Number(idRaw))).get()
    : null;
  const taken = db.select().from(promoCodes).where(eq(promoCodes.code, parsed.data.code)).get();
  if (taken && taken.id !== existing?.id) return fail("Kode promo sudah ada.");

  const values = {
    code: parsed.data.code,
    type: parsed.data.type,
    value: parsed.data.value,
    maxDiscount: parsed.data.maxDiscount ?? null,
    minAmount: parsed.data.minAmount,
    quota: parsed.data.quota ?? null,
    startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    isActive: parsed.data.isActive,
  };
  if (existing) {
    db.update(promoCodes).set(values).where(eq(promoCodes.id, existing.id)).run();
  } else {
    db.insert(promoCodes).values(values).run();
  }
  await writeAudit({
    actor: admin,
    action: existing ? "update_promo" : "create_promo",
    entity: "promo",
    entityId: existing ? String(existing.id) : parsed.data.code,
    after: values,
  });
  revalidatePath("/admin/promo");
  return done(existing ? "Kode promo diperbarui." : "Kode promo dibuat.");
}

export async function togglePromoAction(id: number): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const promo = db.select().from(promoCodes).where(eq(promoCodes.id, id)).get();
  if (!promo) return fail("Promo tidak ditemukan.");
  db.update(promoCodes).set({ isActive: !promo.isActive }).where(eq(promoCodes.id, id)).run();
  revalidatePath("/admin/promo");
  return done(promo.isActive ? "Promo dinonaktifkan." : "Promo diaktifkan.");
}

export async function deletePromoAction(id: number): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const promo = db.select().from(promoCodes).where(eq(promoCodes.id, id)).get();
  if (!promo) return fail("Promo tidak ditemukan.");
  if (promo.usedCount > 0) {
    db.update(promoCodes).set({ isActive: false }).where(eq(promoCodes.id, id)).run();
    revalidatePath("/admin/promo");
    return done("Promo sudah pernah dipakai, jadi hanya dinonaktifkan.");
  }
  db.delete(promoCodes).where(eq(promoCodes.id, id)).run();
  revalidatePath("/admin/promo");
  return done("Promo dihapus.");
}

/* ── User & saldo ──────────────────────────────────────────── */
export async function userManagementAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ password?: string }>> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const parsed = userActionSchema.safeParse({
    userId: formData.get("userId"),
    action: formData.get("action"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const target = db.select().from(users).where(eq(users.id, parsed.data.userId)).get();
  if (!target) return fail("Pengguna tidak ditemukan.");
  if (target.id === admin.id && parsed.data.action !== "reset_password") {
    return fail("Kamu tidak dapat mengubah status atau role akunmu sendiri.");
  }

  if (parsed.data.action === "suspend") {
    db.update(users).set({ status: "suspended", updatedAt: new Date() }).where(eq(users.id, target.id)).run();
    const { sessions } = await import("@/lib/db/schema");
    db.delete(sessions).where(eq(sessions.userId, target.id)).run();
  } else if (parsed.data.action === "activate") {
    db.update(users).set({ status: "active", updatedAt: new Date() }).where(eq(users.id, target.id)).run();
  } else if (parsed.data.action === "make_admin") {
    db.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, target.id)).run();
  } else if (parsed.data.action === "remove_admin") {
    if (target.role === "admin") {
      const admins = db.select().from(users).where(eq(users.role, "admin")).all();
      if (admins.length <= 1) return fail("Minimal harus ada satu admin.");
    }
    db.update(users).set({ role: "user", updatedAt: new Date() }).where(eq(users.id, target.id)).run();
  } else if (parsed.data.action === "verify") {
    const now = new Date();
    db.update(users)
      .set({
        emailVerifiedAt: target.emailVerifiedAt ?? now,
        ...(target.phone ? { phoneVerifiedAt: target.phoneVerifiedAt ?? now } : {}),
        updatedAt: now,
      })
      .where(eq(users.id, target.id))
      .run();
  } else if (parsed.data.action === "reset_password") {
    const password = randomPassword(16);
    const passwordHash = await hashPassword(password);
    db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, target.id))
      .run();
    const { sessions } = await import("@/lib/db/schema");
    db.delete(sessions).where(eq(sessions.userId, target.id)).run();
    await writeAudit({
      actor: admin,
      action: "reset_user_password",
      entity: "user",
      entityId: target.id,
    });
    revalidatePath(`/admin/users/${target.id}`);
    return done(
      `Password sementara untuk ${target.email}: ${password} — catat sekarang, tidak akan ditampilkan lagi.`,
      { data: { password } },
    );
  }

  await writeAudit({
    actor: admin,
    action: `user_${parsed.data.action}`,
    entity: "user",
    entityId: target.id,
    after: { action: parsed.data.action },
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${target.id}`);
  return done("Pengguna diperbarui.");
}

export async function adjustBalanceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const parsed = adjustBalanceSchema.safeParse({
    userId: formData.get("userId"),
    amount: formData.get("amount"),
    note: formData.get("note"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const user = db.select().from(users).where(eq(users.id, parsed.data.userId)).get();
  if (!user) return fail("Pengguna tidak ditemukan.");
  const newBalance = user.balance + parsed.data.amount;
  if (newBalance < 0) return fail("Saldo tidak boleh negatif.");

  db.transaction((tx) => {
    tx.update(users).set({ balance: newBalance, updatedAt: new Date() }).where(eq(users.id, user.id)).run();
    tx.insert(balanceTransactions)
      .values({
        id: uid("bt_", 16),
        userId: user.id,
        type: "adjustment",
        amount: parsed.data.amount,
        balanceAfter: newBalance,
        ref: admin.id,
        note: parsed.data.note,
        createdBy: admin.id,
      })
      .run();
  });
  await writeAudit({
    actor: admin,
    action: "adjust_balance",
    entity: "user",
    entityId: user.id,
    after: { amount: parsed.data.amount, note: parsed.data.note, balance: newBalance },
  });
  await notifyUserEvent({
    userId: user.id,
    event: "balance_adjusted",
    title: "Saldo disesuaikan",
    body: `Saldo kamu ${parsed.data.amount > 0 ? "bertambah" : "berkurang"} ${formatIDR(Math.abs(parsed.data.amount))}. Saldo sekarang ${formatIDR(newBalance)}.`,
    link: "/dashboard/saldo",
    emailVars: {
      total: formatIDR(Math.abs(parsed.data.amount)),
      saldo: formatIDR(newBalance),
      catatan: parsed.data.note,
      link: "/dashboard/saldo",
    },
    waPayload: {
      total: formatIDR(Math.abs(parsed.data.amount)),
      saldo: formatIDR(newBalance),
      catatan: parsed.data.note,
      link: "/dashboard/saldo",
    },
  });
  revalidatePath(`/admin/users/${user.id}`);
  revalidatePath("/admin/users");
  return done(`Saldo ${user.name} diperbarui menjadi ${formatIDR(newBalance)}.`);
}

/* ── Pembayaran & order ────────────────────────────────────── */
export async function verifyManualPaymentAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const parsed = verifyManualPaymentSchema.safeParse({
    paymentId: formData.get("paymentId"),
    decision: formData.get("decision"),
    reason: formString(formData, "reason") || undefined,
  });
  if (!parsed.success) return fromZod(parsed.error);
  const payment = db.select().from(payments).where(eq(payments.id, parsed.data.paymentId)).get();
  if (!payment) return fail("Pembayaran tidak ditemukan.");
  if (payment.status !== "pending") return fail("Pembayaran ini sudah diproses.");

  if (parsed.data.decision === "reject") {
    if (!parsed.data.reason) return fail("Alasan penolakan wajib diisi.");
    db.update(payments)
      .set({
        status: "rejected",
        rejectionReason: parsed.data.reason,
        verifiedBy: admin.id,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id))
      .run();
    const invoice = db.select().from(invoices).where(eq(invoices.id, payment.invoiceId)).get();
    await writeAudit({
      actor: admin,
      action: "reject_payment",
      entity: "payment",
      entityId: payment.id,
      after: { reason: parsed.data.reason },
    });
    if (invoice) {
      await notifyUserEvent({
        userId: invoice.userId,
        event: "payment_rejected",
        title: "Bukti pembayaran ditolak",
        body: `Bukti untuk ${invoice.invoiceNumber} ditolak: ${parsed.data.reason}`,
        link: `/dashboard/invoices/${invoice.id}`,
        notifyEmail: false,
        waPayload: {
          invoice_number: invoice.invoiceNumber,
          alasan: parsed.data.reason,
          link: `/dashboard/invoices/${invoice.id}`,
        },
      });
    }
    revalidatePath("/admin/payments");
    return done("Pembayaran ditolak.");
  }

  try {
    const invoice = db.select().from(invoices).where(eq(invoices.id, payment.invoiceId)).get();
    if (!invoice) return fail("Invoice tidak ditemukan.");
    await settleInvoice({
      invoiceId: payment.invoiceId,
      provider: payment.provider,
      providerRef: payment.providerRef ?? invoice.invoiceNumber,
      method: payment.method ?? "manual",
      paymentId: payment.id,
      verifiedBy: admin.id,
    });
    await writeAudit({
      actor: admin,
      action: "verify_payment",
      entity: "payment",
      entityId: payment.id,
      after: { invoiceId: payment.invoiceId, amount: payment.amount },
    });
    revalidatePath("/admin/payments");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/invoices");
    return done("Pembayaran diverifikasi dan invoice ditandai lunas.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function markInvoicePaidAction(invoiceId: string): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const invoice = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
  if (!invoice) return fail("Invoice tidak ditemukan.");
  try {
    await settleInvoice({
      invoiceId,
      provider: "manual",
      providerRef: `ADMIN-${invoice.invoiceNumber}`,
      method: "manual",
      verifiedBy: admin.id,
    });
    await writeAudit({
      actor: admin,
      action: "mark_invoice_paid",
      entity: "invoice",
      entityId: invoiceId,
    });
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/orders");
    return done("Invoice ditandai lunas.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function adminOrderAction(
  orderId: string,
  action: "retry" | "refund" | "cancel",
  note?: string,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  try {
    if (action === "retry") {
      await retryProvisioning(orderId);
      revalidatePath(`/admin/orders/${orderId}`);
      return done("Pembuatan server dijadwalkan ulang.");
    }
    if (action === "refund") {
      const result = await refundOrder(orderId, admin.id, note?.trim() || "Refund oleh admin");
      revalidatePath(`/admin/orders/${orderId}`);
      revalidatePath("/admin/orders");
      return done(
        result.alreadyRefunded
          ? `Pesanan ini sudah direfund ${formatIDR(result.amount)} ke saldo user.`
          : `Refund ${formatIDR(result.amount)} masuk ke saldo user.`,
      );
    }
    const order = db.select().from(invoices).where(eq(invoices.orderId, orderId)).get();
    if (order && order.status === "unpaid") {
      db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, order.id)).run();
    }
    const { orders } = await import("@/lib/db/schema");
    db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId)).run();
    revalidatePath(`/admin/orders/${orderId}`);
    return done("Pesanan dibatalkan.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

/* ── Pengaturan ────────────────────────────────────────────── */
export type SettingsSection =
  | "general"
  | "announcement"
  | "digitalocean"
  | "pricing"
  | "payment"
  | "email"
  | "notification";

function keepEncryptedBlank(values: Record<string, string>) {
  for (const key of ENCRYPTED_SETTING_KEYS) {
    if (key in values && !values[key]) delete values[key];
  }
  return values;
}

export async function saveSettingsAction(
  section: SettingsSection,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  try {
    if (section === "general") {
      const parsed = generalSettingsSchema.safeParse({
        site_name: formData.get("site_name"),
        site_tagline: formData.get("site_tagline") || "",
        site_description: formData.get("site_description") || "",
        site_logo_url: formData.get("site_logo_url") || "",
        site_favicon_url: formData.get("site_favicon_url") || "",
        support_email: formData.get("support_email"),
        support_whatsapp: formData.get("support_whatsapp"),
        maintenance_mode: formBool(formData, "maintenance_mode"),
        captcha_enabled: formBool(formData, "captcha_enabled"),
        turnstile_site_key: formString(formData, "turnstile_site_key"),
        turnstile_secret_key: formString(formData, "turnstile_secret_key") || undefined,
      });
      if (!parsed.success) return fromZod(parsed.error);
      setSettings(
        keepEncryptedBlank({
          ...parsed.data,
          maintenance_mode: String(parsed.data.maintenance_mode),
          captcha_enabled: String(parsed.data.captcha_enabled),
          turnstile_secret_key: parsed.data.turnstile_secret_key ?? "",
        }),
        admin.id,
      );
    } else if (section === "announcement") {
      const parsed = announcementSchema.safeParse({
        announcement_active: formBool(formData, "announcement_active"),
        announcement_text: formData.get("announcement_text") || "",
        announcement_link: formData.get("announcement_link") || "",
        announcement_tone: formData.get("announcement_tone") || "info",
      });
      if (!parsed.success) return fromZod(parsed.error);
      setSettings(
        {
          announcement_active: String(parsed.data.announcement_active),
          announcement_text: parsed.data.announcement_text,
          announcement_link: parsed.data.announcement_link,
          announcement_tone: parsed.data.announcement_tone,
        },
        admin.id,
      );
    } else if (section === "digitalocean") {
      const parsed = doSettingsSchema.safeParse({
        do_token: formString(formData, "do_token") || undefined,
        do_default_region: formData.get("do_default_region"),
        do_mock_mode: formBool(formData, "do_mock_mode"),
      });
      if (!parsed.success) return fromZod(parsed.error);
      const values = keepEncryptedBlank({
        do_token: parsed.data.do_token ?? "",
        do_default_region: parsed.data.do_default_region,
        do_mock_mode: String(parsed.data.do_mock_mode),
      });
      setSettings(values, admin.id);
    } else if (section === "pricing") {
      const parsed = pricingSettingsSchema.safeParse({
        usd_idr_rate: formData.get("usd_idr_rate"),
        default_markup_percent: formData.get("default_markup_percent"),
        invoice_due_reminder_days: formData.get("invoice_due_reminder_days") || "3,1",
        grace_period_days: formData.get("grace_period_days"),
      });
      if (!parsed.success) return fromZod(parsed.error);
      setSettings(
        {
          usd_idr_rate: String(parsed.data.usd_idr_rate),
          default_markup_percent: String(parsed.data.default_markup_percent),
          invoice_due_reminder_days: parsed.data.invoice_due_reminder_days,
          grace_period_days: String(parsed.data.grace_period_days),
        },
        admin.id,
      );
      recalculateAutoPlanPrices();
    } else if (section === "payment") {
      const parsed = paymentSettingsSchema.safeParse({
        tripay_enabled: formBool(formData, "tripay_enabled"),
        tripay_api_key: formString(formData, "tripay_api_key") || undefined,
        tripay_private_key: formString(formData, "tripay_private_key") || undefined,
        tripay_merchant_code: formString(formData, "tripay_merchant_code") || undefined,
        tripay_is_sandbox: formBool(formData, "tripay_is_sandbox"),
        manual_enabled: formBool(formData, "manual_enabled"),
        manual_bank_name: formString(formData, "manual_bank_name") || "BCA",
        manual_account_number: formString(formData, "manual_account_number"),
        manual_account_name: formString(formData, "manual_account_name"),
        manual_instructions: formString(formData, "manual_instructions"),
        payment_providers_order: formString(formData, "payment_providers_order") || "manual,tripay",
      });
      if (!parsed.success) return fromZod(parsed.error);
      const values = keepEncryptedBlank(
        Object.fromEntries(
          Object.entries(parsed.data)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        ),
      );
      setSettings(values, admin.id);
    } else if (section === "email") {
      const parsed = emailSettingsSchema.safeParse({
        smtp_host: formString(formData, "smtp_host") || undefined,
        smtp_port: formString(formData, "smtp_port") || "587",
        smtp_secure: formBool(formData, "smtp_secure"),
        smtp_user: formString(formData, "smtp_user") || undefined,
        smtp_pass: formString(formData, "smtp_pass") || undefined,
        email_from: formData.get("email_from"),
      });
      if (!parsed.success) return fromZod(parsed.error);
      const secret = keepEncryptedBlank({ smtp_pass: parsed.data.smtp_pass ?? "" });
      setSettings(
        {
          smtp_host: parsed.data.smtp_host ?? "",
          smtp_port: String(parsed.data.smtp_port),
          smtp_secure: String(parsed.data.smtp_secure),
          smtp_user: parsed.data.smtp_user ?? "",
          email_from: parsed.data.email_from,
          ...secret,
        },
        admin.id,
      );
    } else {
      const parsed = notificationSettingsSchema.safeParse({
        wa_enabled: formBool(formData, "wa_enabled"),
        wa_notify_admin_numbers: formString(formData, "wa_notify_admin_numbers"),
        wa_admin_events: formData.getAll("wa_admin_events").map(String),
        wa_user_events: formData.getAll("wa_user_events").map(String),
      });
      if (!parsed.success) return fromZod(parsed.error);
      setSettings(
        {
          wa_enabled: String(parsed.data.wa_enabled),
          wa_notify_admin_numbers: parsed.data.wa_notify_admin_numbers,
          wa_admin_events: JSON.stringify(parsed.data.wa_admin_events),
          wa_user_events: JSON.stringify(parsed.data.wa_user_events),
        },
        admin.id,
      );
    }

    await writeAudit({
      actor: admin,
      action: `save_settings_${section}`,
      entity: "settings",
      entityId: section,
    });
    revalidatePath("/admin/settings");
    revalidatePath("/");
    revalidatePath("/pricing");
    return done("Pengaturan disimpan.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function saveEmailTemplateAction(
  key: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const subject = formString(formData, "subject");
  const body = formString(formData, "body");
  if (!subject || !body) return fail("Subjek dan isi email wajib diisi.");
  setSettings(
    { [`email_subject_${key}`]: subject, [`email_template_${key}`]: body },
    admin.id,
  );
  revalidatePath("/admin/settings");
  return done("Template email disimpan.");
}

export async function saveWaTemplateAction(
  key: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const body = formString(formData, "body");
  const title = formString(formData, "title");
  if (!body || !title) return fail("Judul dan isi template wajib diisi.");
  const existing = db.select().from(waTemplates).where(eq(waTemplates.key, key)).get();
  if (existing) {
    db.update(waTemplates)
      .set({ title, body, isActive: formBool(formData, "isActive"), updatedBy: admin.id, updatedAt: new Date() })
      .where(eq(waTemplates.key, key))
      .run();
  } else {
    db.insert(waTemplates)
      .values({ key, title, body, isActive: formBool(formData, "isActive"), updatedBy: admin.id })
      .run();
  }
  revalidatePath("/admin/whatsapp");
  return done("Template WhatsApp disimpan.");
}

export async function testEmailAction(): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const s = getSettings();
  const res = await sendEmail({
    to: admin.email,
    subject: `Uji email ${s.site_name}`,
    body: getTestEmailBody(s.site_name),
    templateKey: "test",
  });
  if (!res.ok) return fail(res.error ?? "Email gagal dikirim.");
  return done(
    res.logged
      ? "SMTP belum dikonfigurasi. Email uji tercatat di log server."
      : `Email uji dikirim ke ${admin.email}.`,
  );
}

export async function saveDoAccountAction(
  accountId: string | null,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const parsed = doAccountSchema.safeParse({
    name: formData.get("name"),
    token: formString(formData, "token") || undefined,
    isDefault: formBool(formData, "isDefault"),
    isActive: formBool(formData, "isActive"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  if (!accountId && !parsed.data.token) {
    return fail("Token DigitalOcean wajib diisi untuk akun baru.");
  }
  try {
    if (accountId) {
      updateDoAccount({
        id: accountId,
        name: parsed.data.name,
        token: parsed.data.token,
        isDefault: parsed.data.isDefault,
        isActive: parsed.data.isActive,
      });
    } else {
      createDoAccount({
        name: parsed.data.name,
        token: parsed.data.token!,
        isDefault: parsed.data.isDefault,
        isActive: parsed.data.isActive,
      });
    }
    await writeAudit({
      actor: admin,
      action: accountId ? "update_do_account" : "create_do_account",
      entity: "digitalocean",
      entityId: accountId ?? parsed.data.name,
    });
    revalidatePath("/admin/settings");
    return done(accountId ? "Akun DigitalOcean diperbarui." : "Akun DigitalOcean ditambahkan.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function deleteDoAccountAction(accountId: string): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  try {
    deleteDoAccount(accountId);
    await writeAudit({
      actor: admin,
      action: "delete_do_account",
      entity: "digitalocean",
      entityId: accountId,
    });
    revalidatePath("/admin/settings");
    return done("Akun DigitalOcean dihapus.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function setDefaultDoAccountAction(accountId: string): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  try {
    setDefaultDoAccount(accountId);
    await writeAudit({
      actor: admin,
      action: "set_default_do_account",
      entity: "digitalocean",
      entityId: accountId,
    });
    revalidatePath("/admin/settings");
    return done("Akun default DigitalOcean diperbarui.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function testDoConnectionAction(
  accountId?: string,
): Promise<ActionResult<{ mock: boolean; email: string }>> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  try {
    const info = await testDoConnection(accountId);
    const label = accountId ? getDoAccountById(accountId)?.name : null;
    return done(
      info.mock
        ? "Mode mock aktif. Koneksi DigitalOcean tidak dipanggil."
        : `Terhubung ke akun DigitalOcean ${info.account.email}${label ? ` (${label})` : ""}.`,
      { data: { mock: info.mock, email: info.account.email } },
    );
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function syncDoServicesAction(): Promise<ActionResult<DoServiceSyncResult>> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  try {
    const result = await syncDigitalOceanServices();
    await writeAudit({
      actor: admin,
      action: "sync_do_services",
      entity: "service",
      entityId: "digitalocean",
      after: {
        fetched: result.fetched,
        linked: result.linked,
        updated: result.updated,
        untracked: result.untracked,
        missing: result.missing,
      },
    });
    revalidatePath("/admin/services");
    const suffix = result.missing > 0 ? ` ${result.missing} layanan di database tidak ditemukan di DO.` : "";
    return done(
      result.mock
        ? "Mode mock aktif. Daftar droplet diambil dari simulasi, bukan API DigitalOcean."
        : `Berhasil mengambil ${result.fetched} droplet: ${result.linked} terhubung, ${result.updated} diperbarui, ${result.untracked} belum terhubung.${suffix}`,
      { data: result },
    );
  } catch (error) {
    return fail(errorMessage(error));
  }
}

/* ── WhatsApp worker ───────────────────────────────────────── */
async function workerCall<T = unknown>(
  path: string,
  payload?: Record<string, unknown>,
): Promise<{ ok: boolean; message: string; data?: T }> {
  const base = process.env.WA_WORKER_URL ?? "http://127.0.0.1:3001";
  try {
    const res = await fetch(`${base}${path}`, {
      method: payload ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_SECRET ?? "",
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      return { ok: false, message: data.message || "Worker WhatsApp menolak permintaan." };
    }
    return { ok: true, message: data.message || "Permintaan diteruskan ke worker.", data: data as T };
  } catch {
    return {
      ok: false,
      message:
        "Worker WhatsApp tidak berjalan. Jalankan `npm run wa:worker` di server, lalu coba lagi.",
    };
  }
}

export async function waConnectAction(mode: "qr" | "pairing", phone?: string): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  if (mode === "pairing" && (!phone || phone.replace(/\D/g, "").length < 9)) {
    return fail("Nomor WhatsApp untuk pairing tidak valid.");
  }
  const res = await workerCall("/pair", { mode, phone });
  revalidatePath("/admin/whatsapp");
  return res.ok ? done(res.message) : fail(res.message);
}

export async function waLogoutAction(): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const res = await workerCall("/logout", {});
  if (res.ok) {
    db.update(waState)
      .set({
        status: "disconnected",
        phone: null,
        profileName: null,
        connectedAt: null,
        lastQr: null,
        pairingCode: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(waState.id, "singleton"))
      .run();
  }
  revalidatePath("/admin/whatsapp");
  return res.ok ? done("WhatsApp diputuskan.") : fail(res.message);
}

export async function waRefreshStatusAction(): Promise<ActionResult<{ status: string }>> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const res = await workerCall<{ status?: string }>("/status");
  revalidatePath("/admin/whatsapp");
  if (!res.ok) return fail(res.message);
  return done("Status diperbarui.", { data: { status: res.data?.status ?? "unknown" } });
}

export async function waTestMessageAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const to = formString(formData, "to");
  const message = formString(formData, "message");
  if (!to || !message) return fail("Nomor dan pesan wajib diisi.");
  const id = queueWhatsApp({
    to,
    templateKey: "test",
    payload: { message },
    priority: 10,
  });
  if (!id) return fail("Nomor tidak valid atau WhatsApp nonaktif.");
  const res = await workerCall("/process-outbox", {});
  revalidatePath("/admin/whatsapp");
  return done(
    res.ok
      ? "Pesan uji masuk antrean dan sudah diproses worker."
      : "Pesan masuk antrean. Worker belum berjalan, pesan akan dikirim saat worker aktif.",
  );
}

export async function retryWaMessagesAction(ids: string[]): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  if (!ids.length) return fail("Tidak ada pesan yang dipilih.");
  const { retryWaMessages } = await import("@/lib/whatsapp/queue");
  retryWaMessages(ids);
  revalidatePath("/admin/whatsapp");
  return done(`${ids.length} pesan dimasukkan kembali ke antrean.`);
}

/* ── Operasional ───────────────────────────────────────────── */
export async function runCronAction(): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  try {
    const summary = await runCron();
    revalidatePath("/admin");
    revalidatePath("/admin/logs");
    return done("Cron selesai dijalankan.", { data: summary });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function forceLogoutAllAction(): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const { sessions } = await import("@/lib/db/schema");
  const count = db.select().from(sessions).all().length;
  db.delete(sessions).run();
  setSettings({ security_force_logout_at: new Date().toISOString() }, admin.id);
  await writeAudit({
    actor: admin,
    action: "force_logout_all",
    entity: "security",
    after: { sessions: count },
  });
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.delete("pansa_session");
  return done("Semua sesi dikeluarkan. Kamu perlu masuk kembali.", { redirectTo: "/login" });
}

export async function revealSettingSecretAction(key: string): Promise<ActionResult<{ masked: string }>> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  if (!ENCRYPTED_SETTING_KEYS.has(key)) return fail("Kunci ini bukan rahasia.");
  const value = getSettings()[key] ?? "";
  return done("Secret dimuat (disamarkan).", { data: { masked: value ? maskSecret(value) : "" } });
}

export async function deleteSettingAction(key: string): Promise<ActionResult> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  if (!(key in getSettings())) return fail("Pengaturan tidak ditemukan.");
  db.delete(settings).where(eq(settings.key, key)).run();
  revalidatePath("/admin/settings");
  return done("Nilai dikembalikan ke default.");
}

export async function exportCsvAction(type: "orders" | "invoices" | "users"): Promise<ActionResult<{ csv: string; filename: string }>> {
  const admin = await requireAdminAction();
  if (!admin) return fail("Hanya admin.");
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  if (type === "users") {
    const rows = db.select().from(users).all();
    const csv = [
      "id,nama,email,telepon,role,status,saldo,dibuat",
      ...rows.map((r) =>
        [r.id, r.name, r.email, r.phone, r.role, r.status, r.balance, r.createdAt.toISOString()]
          .map(escape)
          .join(","),
      ),
    ].join("\n");
    return done("CSV pengguna siap.", { data: { csv, filename: "pengguna.csv" } });
  }
  if (type === "invoices") {
    const rows = db.select().from(invoices).all();
    const csv = [
      "nomor,tipe,status,nominal,jatuh_tempo,dibayar",
      ...rows.map((r) =>
        [r.invoiceNumber, r.type, r.status, r.amount, r.dueDate?.toISOString(), r.paidAt?.toISOString()]
          .map(escape)
          .join(","),
      ),
    ].join("\n");
    return done("CSV invoice siap.", { data: { csv, filename: "invoice.csv" } });
  }
  const { orders } = await import("@/lib/db/schema");
  const rows = db.select().from(orders).all();
  const csv = [
    "nomor,status,hostname,region,os,siklus,total,dibuat",
    ...rows.map((r) =>
      [
        r.orderNumber,
        r.status,
        r.hostname,
        r.regionSlug,
        r.osSlug,
        r.billingCycle,
        r.priceSnapshot.total,
        r.createdAt.toISOString(),
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\n");
  return done("CSV pesanan siap.", { data: { csv, filename: "pesanan.csv" } });
}
