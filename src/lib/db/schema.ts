import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* ──────────────────────────────────────────────────────────────
   Tipe domain yang dipakai lintas server/client
   ────────────────────────────────────────────────────────────── */
export type Role = "admin" | "user";
export type UserStatus = "active" | "suspended";
export type BillingCycle = "monthly" | "quarterly" | "yearly";
export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "provisioning"
  | "active"
  | "failed"
  | "cancelled"
  | "expired";
export type InvoiceType = "new" | "renewal" | "upgrade" | "topup";
export type InvoiceStatus = "unpaid" | "paid" | "cancelled" | "expired" | "refunded";
export type PaymentStatus = "pending" | "paid" | "failed" | "rejected";
export type ServiceStatus =
  | "provisioning"
  | "active"
  | "suspended"
  | "terminated"
  | "failed";

export interface PriceSnapshot {
  planName: string;
  planSlug: string;
  cycle: BillingCycle;
  months: number;
  unitPrice: number;
  subtotal: number;
  setupFee: number;
  discount: number;
  total: number;
  promoCode?: string | null;
  promoDescription?: string | null;
  currency: "IDR";
}

export interface WaTemplatePayload {
  [key: string]: string | number | null | undefined;
}

const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () =>
  ts("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

/* ──────────────────────────────────────────────────────────────
   1. Users & sessions
   ────────────────────────────────────────────────────────────── */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<Role>().notNull().default("user"),
    status: text("status").$type<UserStatus>().notNull().default("active"),
    emailVerifiedAt: ts("email_verified_at"),
    phoneVerifiedAt: ts("phone_verified_at"),
    balance: integer("balance").notNull().default(0),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("users_role_idx").on(t.role)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const authTokens = sqliteTable(
  "auth_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type")
      .$type<"email_verify" | "phone_verify" | "password_reset">()
      .notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId)],
);

/* ──────────────────────────────────────────────────────────────
   2. Settings
   ────────────────────────────────────────────────────────────── */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedBy: text("updated_by"),
  updatedAt: updatedAt(),
});

/* ──────────────────────────────────────────────────────────────
   3. Katalog: paket, riwayat harga, region, OS
   ────────────────────────────────────────────────────────────── */
export const plans = sqliteTable(
  "plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    doSizeSlug: text("do_size_slug").notNull().default(""),
    vcpus: integer("vcpus").notNull().default(1),
    ramMb: integer("ram_mb").notNull().default(1024),
    diskGb: integer("disk_gb").notNull().default(25),
    transferTb: integer("transfer_tb").notNull().default(1),
    costMonthlyUsd: real("cost_monthly_usd").notNull().default(0),
    priceMonthly: integer("price_monthly").notNull().default(0),
    pricingMode: text("pricing_mode", { enum: ["auto", "custom"] })
      .notNull()
      .default("auto"),
    priceQuarterly: integer("price_quarterly"),
    priceYearly: integer("price_yearly"),
    promoPriceMonthly: integer("promo_price_monthly"),
    setupFee: integer("setup_fee").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    isFeatured: integer("is_featured", { mode: "boolean" })
      .notNull()
      .default(false),
    allowRegionSlugs: text("allow_region_slugs", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'["sgp1"]'`),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("plans_active_idx").on(t.isActive, t.sortOrder)],
);

export const planPriceHistory = sqliteTable(
  "plan_price_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planId: integer("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    changedBy: text("changed_by"),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    createdAt: createdAt(),
  },
  (t) => [index("plan_history_plan_idx").on(t.planId)],
);

export const regions = sqliteTable("regions", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull().default(""),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  pingMs: integer("ping_ms"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const osImages = sqliteTable("os_images", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  distribution: text("distribution").notNull().default(""),
  version: text("version").notNull().default(""),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  logoKey: text("logo_key"),
});

/* ──────────────────────────────────────────────────────────────
   4. Order, invoice, payment
   ────────────────────────────────────────────────────────────── */
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: integer("plan_id")
      .notNull()
      .references(() => plans.id),
    regionSlug: text("region_slug").notNull(),
    osSlug: text("os_slug").notNull(),
    hostname: text("hostname").notNull(),
    billingCycle: text("billing_cycle").$type<BillingCycle>().notNull(),
    priceSnapshot: text("price_snapshot", { mode: "json" })
      .$type<PriceSnapshot>()
      .notNull(),
    promoCodeId: integer("promo_code_id"),
    sshKeyId: text("ssh_key_id"),
    status: text("status").$type<OrderStatus>().notNull().default("pending_payment"),
    errorMessage: text("error_message"),
    createdAt: createdAt(),
    paidAt: ts("paid_at"),
    expiresAt: ts("expires_at"),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: text("order_id"),
    serviceId: text("service_id"),
    type: text("type").$type<InvoiceType>().notNull(),
    amount: integer("amount").notNull(),
    status: text("status").$type<InvoiceStatus>().notNull().default("unpaid"),
    dueDate: ts("due_date"),
    paidAt: ts("paid_at"),
    paymentProvider: text("payment_provider"),
    paymentRef: text("payment_ref"),
    notes: text("notes"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("invoices_user_idx").on(t.userId),
    index("invoices_status_idx").on(t.status),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    method: text("method"),
    amount: integer("amount").notNull(),
    status: text("status").$type<PaymentStatus>().notNull().default("pending"),
    rawWebhook: text("raw_webhook", { mode: "json" }).$type<Record<string, unknown>>(),
    verifiedBy: text("verified_by"),
    proofUrl: text("proof_url"),
    rejectionReason: text("rejection_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
);

/* ──────────────────────────────────────────────────────────────
   5. Layanan VPS
   ────────────────────────────────────────────────────────────── */
export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: text("order_id"),
    planId: integer("plan_id")
      .notNull()
      .references(() => plans.id),
    doDropletId: text("do_droplet_id").unique(),
    hostname: text("hostname").notNull(),
    regionSlug: text("region_slug").notNull(),
    osSlug: text("os_slug").notNull(),
    sizeSlug: text("size_slug").notNull(),
    ipv4: text("ipv4"),
    ipv6: text("ipv6"),
    rootPasswordEncrypted: text("root_password_encrypted"),
    sshKeyId: text("ssh_key_id"),
    status: text("status").$type<ServiceStatus>().notNull().default("provisioning"),
    periodStart: ts("period_start"),
    periodEnd: ts("period_end"),
    autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    terminatedAt: ts("terminated_at"),
  },
  (t) => [
    index("services_user_idx").on(t.userId),
    index("services_status_idx").on(t.status),
  ],
);

export const serviceActionsLog = sqliteTable(
  "service_actions_log",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    actor: text("actor").$type<"user" | "admin" | "system">().notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    resultStatus: text("result_status").notNull().default("success"),
    message: text("message"),
    createdAt: createdAt(),
  },
  (t) => [index("service_actions_service_idx").on(t.serviceId)],
);

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    doSnapshotId: text("do_snapshot_id").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("snapshots_service_idx").on(t.serviceId)],
);

export const sshKeys = sqliteTable(
  "ssh_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    publicKey: text("public_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    doSshKeyId: text("do_ssh_key_id"),
    createdAt: createdAt(),
  },
  (t) => [index("ssh_keys_user_idx").on(t.userId)],
);

/* ──────────────────────────────────────────────────────────────
   6. Promo, saldo, tiket, notifikasi
   ────────────────────────────────────────────────────────────── */
export const promoCodes = sqliteTable("promo_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  type: text("type").$type<"percent" | "fixed">().notNull(),
  value: integer("value").notNull(),
  maxDiscount: integer("max_discount"),
  minAmount: integer("min_amount").notNull().default(0),
  quota: integer("quota"),
  usedCount: integer("used_count").notNull().default(0),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const balanceTransactions = sqliteTable(
  "balance_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type")
      .$type<"topup" | "payment" | "refund" | "adjustment">()
      .notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    ref: text("ref"),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("balance_user_idx").on(t.userId)],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    ticketNumber: text("ticket_number").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    department: text("department").notNull().default("teknis"),
    priority: text("priority")
      .$type<"low" | "normal" | "high" | "urgent">()
      .notNull()
      .default("normal"),
    status: text("status").$type<"open" | "answered" | "closed">().notNull().default("open"),
    internalNote: text("internal_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tickets_user_idx").on(t.userId), index("tickets_status_idx").on(t.status)],
);

export const ticketReplies = sqliteTable(
  "ticket_replies",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    authorRole: text("author_role").$type<"user" | "admin" | "system">().notNull(),
    body: text("body").notNull(),
    attachmentUrl: text("attachment_url"),
    createdAt: createdAt(),
  },
  (t) => [index("ticket_replies_ticket_idx").on(t.ticketId)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.isRead)],
);

/* ──────────────────────────────────────────────────────────────
   7. WhatsApp, email, audit, cron, job
   ────────────────────────────────────────────────────────────── */
export const waOutbox = sqliteTable(
  "wa_outbox",
  {
    id: text("id").primaryKey(),
    toNumber: text("to_number").notNull(),
    templateKey: text("template_key").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    status: text("status")
      .$type<"queued" | "sending" | "sent" | "failed">()
      .notNull()
      .default("queued"),
    priority: integer("priority").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    scheduledAt: ts("scheduled_at"),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("wa_outbox_status_idx").on(t.status, t.scheduledAt)],
);

export const waTemplates = sqliteTable("wa_templates", {
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  updatedBy: text("updated_by"),
  updatedAt: updatedAt(),
});

export const waState = sqliteTable("wa_state", {
  id: text("id").primaryKey().default("singleton"),
  status: text("status")
    .$type<"disconnected" | "qr_pending" | "pairing_pending" | "connecting" | "connected">()
    .notNull()
    .default("disconnected"),
  phone: text("phone"),
  profileName: text("profile_name"),
  connectedAt: ts("connected_at"),
  lastQr: text("last_qr"),
  lastQrAt: ts("last_qr_at"),
  pairingCode: text("pairing_code"),
  lastError: text("last_error"),
  updatedAt: updatedAt(),
});

export const emailLog = sqliteTable("email_log", {
  id: text("id").primaryKey(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  templateKey: text("template_key"),
  status: text("status").$type<"sent" | "failed" | "logged">().notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: text("before", { mode: "json" }).$type<Record<string, unknown> | null>(),
    after: text("after", { mode: "json" }).$type<Record<string, unknown> | null>(),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const cronLogs = sqliteTable("cron_logs", {
  id: text("id").primaryKey(),
  job: text("job").notNull(),
  status: text("status").$type<"success" | "partial" | "failed">().notNull(),
  summary: text("summary", { mode: "json" }).$type<Record<string, unknown>>(),
  startedAt: ts("started_at").notNull(),
  finishedAt: ts("finished_at").notNull(),
  createdAt: createdAt(),
});

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    refId: text("ref_id").notNull(),
    status: text("status")
      .$type<"queued" | "processing" | "done" | "failed">()
      .notNull()
      .default("queued"),
    step: integer("step").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    notBefore: ts("not_before"),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jobs_status_idx").on(t.status, t.notBefore)],
);

export const reminderLog = sqliteTable(
  "reminder_log",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull(),
    kind: text("kind").notNull(),
    periodEnd: ts("period_end").notNull(),
    sentAt: createdAt(),
  },
  (t) => [uniqueIndex("reminder_unique_idx").on(t.serviceId, t.kind, t.periodEnd)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: ts("window_start").notNull(),
  expiresAt: ts("expires_at").notNull(),
});

/* ──────────────────────────────────────────────────────────────
   Tipe inferensi Drizzle
   ────────────────────────────────────────────────────────────── */
export type User = typeof users.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type OsImage = typeof osImages.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
export type SshKey = typeof sshKeys.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type BalanceTransaction = typeof balanceTransactions.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type TicketReply = typeof ticketReplies.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type WaOutbox = typeof waOutbox.$inferSelect;
export type WaTemplate = typeof waTemplates.$inferSelect;
export type WaState = typeof waState.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Job = typeof jobs.$inferSelect;
