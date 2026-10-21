import { z } from "zod";
import { isValidPhone, normalizePhone } from "@/lib/format";

const email = z
  .string()
  .trim()
  .min(1, "Email wajib diisi.")
  .email("Format email tidak valid.")
  .transform((v) => v.toLowerCase());

const password = z
  .string()
  .min(8, "Password minimal 8 karakter.")
  .max(72, "Password maksimal 72 karakter.")
  .regex(/[A-Za-z]/, "Password harus mengandung huruf.")
  .regex(/[0-9]/, "Password harus mengandung angka.");

const phoneOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? normalizePhone(v) : ""))
  .refine((v) => !v || isValidPhone(v), "Nomor WhatsApp tidak valid. Contoh: 08123456789.");

const phoneRequired = z
  .string()
  .trim()
  .min(1, "Nomor WhatsApp wajib diisi.")
  .transform((v) => normalizePhone(v))
  .refine((v) => isValidPhone(v), "Nomor WhatsApp tidak valid. Contoh: 08123456789.");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
    email,
    password,
    confirmPassword: z.string().min(1, "Ulangi password wajib diisi."),
    phone: phoneRequired,
    acceptTerms: z.literal(true, { message: "Kamu harus menyetujui syarat & ketentuan." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak sama.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password wajib diisi."),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Token tidak valid."),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Konfirmasi password tidak sama.",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
  phone: phoneOptional,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama wajib diisi."),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Konfirmasi password tidak sama.",
    path: ["confirmPassword"],
  });

export const sshKeySchema = z.object({
  name: z.string().trim().min(2, "Nama key minimal 2 karakter.").max(60),
  publicKey: z
    .string()
    .trim()
    .min(20, "Public key tidak valid.")
    .regex(
      /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|sk-ssh-ed25519@openssh\.com)\s+[A-Za-z0-9+/=]+/,
      "Format public key tidak dikenali (ssh-rsa / ssh-ed25519).",
    ),
});

export const ticketSchema = z.object({
  subject: z.string().trim().min(5, "Subjek minimal 5 karakter.").max(120),
  department: z.enum(["teknis", "billing", "umum"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  message: z.string().trim().min(10, "Pesan minimal 10 karakter.").max(5000),
});

export const ticketReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(1, "Balasan tidak boleh kosong.").max(5000),
});

export const planSchema = z.object({
  name: z.string().trim().min(2, "Nama paket minimal 2 karakter.").max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan strip."),
  description: z.string().max(500).default(""),
  doSizeSlug: z.string().trim().min(1, "Pilih size DigitalOcean."),
  vcpus: z.coerce.number().int().min(1).max(64),
  ramMb: z.coerce.number().int().min(256).max(262144),
  diskGb: z.coerce.number().int().min(5).max(3200),
  transferTb: z.coerce.number().int().min(0).max(100),
  costMonthlyUsd: z.coerce.number().min(0).max(100000),
  priceMonthly: z.coerce.number().int().min(0).max(1_000_000_000),
  priceQuarterly: z.coerce.number().int().min(0).max(1_000_000_000).nullable().optional(),
  priceYearly: z.coerce.number().int().min(0).max(1_000_000_000).nullable().optional(),
  promoPriceMonthly: z.coerce.number().int().min(0).max(1_000_000_000).nullable().optional(),
  setupFee: z.coerce.number().int().min(0).max(100_000_000).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  allowRegionSlugs: z.array(z.string()).min(1, "Pilih minimal satu region."),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  confirmBelowCost: z.boolean().optional().default(false),
});

export const promoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Kode minimal 3 karakter.")
    .max(30)
    .regex(/^[A-Z0-9_-]+$/, "Kode hanya boleh huruf besar, angka, - dan _.")
    .transform((v) => v.toUpperCase()),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().int().min(1).max(1_000_000_000),
  maxDiscount: z.coerce.number().int().min(0).nullable().optional(),
  minAmount: z.coerce.number().int().min(0).default(0),
  quota: z.coerce.number().int().min(0).nullable().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const orderSchema = z.object({
  planId: z.coerce.number().int().positive(),
  regionSlug: z.string().min(1, "Pilih region."),
  osSlug: z.string().min(1, "Pilih sistem operasi."),
  hostname: z
    .string()
    .trim()
    .min(3, "Hostname minimal 3 karakter.")
    .max(63)
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      "Hostname hanya huruf kecil, angka, dan strip (tanpa titik).",
    ),
  billingCycle: z.enum(["monthly", "quarterly", "yearly"]),
  promoCode: z.string().trim().max(30).optional().or(z.literal("")),
  paymentMethod: z.enum(["balance", "manual", "tripay"]),
  paymentChannel: z.string().trim().max(30).optional(),
  sshMode: z.enum(["password", "existing", "new"]).default("password"),
  sshKeyId: z.string().optional(),
  newSshKeyName: z.string().trim().max(60).optional(),
  newSshKeyPublic: z.string().trim().max(2000).optional(),
});

export const serviceActionSchema = z.object({
  serviceId: z.string().min(1),
  action: z.enum([
    "power_on",
    "power_off",
    "shutdown",
    "power_cycle",
    "reboot",
    "password_reset",
    "rebuild",
    "snapshot",
    "delete_snapshot",
    "enable_ipv6",
    "enable_backups",
    "disable_backups",
    "rename",
    "sync",
    "suspend",
    "unsuspend",
    "terminate",
  ]),
  image: z.string().optional(),
  name: z.string().optional(),
  snapshotId: z.string().optional(),
  confirmHostname: z.string().optional(),
});

export const topupSchema = z.object({
  amount: z.coerce
    .number()
    .int()
    .min(10_000, "Minimal top up Rp 10.000.")
    .max(50_000_000, "Maksimal top up Rp 50.000.000."),
  method: z.enum(["manual", "tripay"]),
  paymentChannel: z.string().trim().max(30).optional(),
});

export const renewSchema = z.object({
  serviceId: z.string().min(1),
  cycle: z.enum(["monthly", "quarterly", "yearly"]),
  paymentMethod: z.enum(["balance", "manual", "tripay"]),
  paymentChannel: z.string().trim().max(30).optional(),
});

export const upgradeSchema = z.object({
  serviceId: z.string().min(1),
  targetPlanId: z.coerce.number().int().positive(),
  paymentMethod: z.enum(["balance", "manual"]),
});

export const manualProofSchema = z.object({
  invoiceId: z.string().min(1),
  senderName: z.string().trim().min(2, "Nama pengirim wajib diisi.").max(80),
  note: z.string().trim().max(300).optional(),
});

export const adjustBalanceSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce
    .number()
    .int()
    .refine((v) => v !== 0, "Nominal tidak boleh nol.")
    .refine((v) => Math.abs(v) <= 100_000_000, "Nominal terlalu besar."),
  note: z.string().trim().min(5, "Catatan wajib diisi (minimal 5 karakter).").max(300),
});

export const generalSettingsSchema = z.object({
  site_name: z.string().trim().min(2, "Nama toko minimal 2 karakter.").max(60),
  site_tagline: z.string().trim().max(160).default(""),
  site_description: z.string().trim().max(400).default(""),
  site_logo_url: z.string().trim().max(500).default(""),
  site_favicon_url: z.string().trim().max(500).default(""),
  support_email: email,
  support_whatsapp: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine(isValidPhone, "Nomor WhatsApp support tidak valid."),
  maintenance_mode: z.boolean().default(false),
  captcha_enabled: z.boolean().default(false),
  turnstile_site_key: z.string().trim().max(200).default(""),
  turnstile_secret_key: z.string().max(500).optional(),
});

export const doSettingsSchema = z.object({
  do_token: z.string().trim().max(500).optional(),
  do_default_region: z.string().trim().min(2).max(20),
  do_mock_mode: z.boolean().default(true),
});

export const doAccountSchema = z.object({
  name: z.string().trim().min(2, "Nama akun minimal 2 karakter.").max(80),
  token: z.string().trim().max(500).optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const pricingSettingsSchema = z.object({
  usd_idr_rate: z.coerce.number().int().min(1000, "Kurs terlalu kecil.").max(100000),
  default_markup_percent: z.coerce.number().min(0).max(500),
  invoice_due_reminder_days: z.string().trim().max(30).default("3,1"),
  grace_period_days: z.coerce.number().int().min(0).max(60),
});

export const paymentSettingsSchema = z.object({
  tripay_enabled: z.boolean().default(false),
  tripay_api_key: z.string().trim().max(500).optional(),
  tripay_private_key: z.string().trim().max(500).optional(),
  tripay_merchant_code: z.string().trim().max(100).optional(),
  tripay_is_sandbox: z.boolean().default(true),
  manual_enabled: z.boolean().default(true),
  manual_bank_name: z.string().trim().max(60).default("BCA"),
  manual_account_number: z.string().trim().max(60).default(""),
  manual_account_name: z.string().trim().max(100).default(""),
  manual_instructions: z.string().trim().max(1000).default(""),
  payment_providers_order: z.string().trim().max(100).default("manual,tripay"),
});

export const emailSettingsSchema = z.object({
  smtp_host: z.string().trim().max(255).optional(),
  smtp_port: z.coerce.number().int().min(1).max(65535).default(587),
  smtp_secure: z.boolean().default(false),
  smtp_user: z.string().trim().max(255).optional(),
  smtp_pass: z.string().max(500).optional(),
  email_from: z.string().trim().min(3).max(200),
});

export const notificationSettingsSchema = z.object({
  wa_enabled: z.boolean().default(true),
  wa_notify_admin_numbers: z.string().trim().max(500).default(""),
  wa_admin_events: z.array(z.string()).default([]),
  wa_user_events: z.array(z.string()).default([]),
});

export const announcementSchema = z.object({
  announcement_active: z.boolean().default(false),
  announcement_text: z.string().trim().max(300).default(""),
  announcement_link: z.string().trim().max(500).default(""),
  announcement_tone: z.enum(["info", "warning", "success"]).default("info"),
});

export const verifyManualPaymentSchema = z.object({
  paymentId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

export const userActionSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["suspend", "activate", "make_admin", "remove_admin", "reset_password", "verify"]),
});

export type PlanInput = z.infer<typeof planSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
