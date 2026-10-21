import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./core";
import {
  osImages,
  plans,
  promoCodes,
  regions,
  settings,
  users,
  waState,
  waTemplates,
} from "./schema";
import { SETTING_DEFAULTS, DEFAULT_EMAIL_TEMPLATES } from "@/lib/settings";
import { DEFAULT_WA_TEMPLATES } from "@/lib/whatsapp/templates";
import { randomPassword } from "@/lib/crypto";
import { roundToNineThousand, suggestedWeeklyPrice } from "@/lib/pricing";

async function seedSettings() {
  const rows = db.select().from(settings).all();
  const existing = new Set(rows.map((r) => r.key));
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    if (!existing.has(key)) {
      db.insert(settings)
        .values({ key, value, updatedBy: "seed", updatedAt: new Date() })
        .run();
    }
  }
  for (const [key, tpl] of Object.entries(DEFAULT_EMAIL_TEMPLATES)) {
    if (!existing.has(`email_template_${key}`)) {
      db.insert(settings)
        .values({ key: `email_template_${key}`, value: tpl.body, updatedBy: "seed" })
        .run();
    }
    if (!existing.has(`email_subject_${key}`)) {
      db.insert(settings)
        .values({ key: `email_subject_${key}`, value: tpl.subject, updatedBy: "seed" })
        .run();
    }
  }
  console.info(`[seed] settings siap (${Object.keys(SETTING_DEFAULTS).length} kunci dasar).`);
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@pansavps.id").toLowerCase();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    if (existing.role !== "admin") {
      db.update(users).set({ role: "admin", status: "active" }).where(eq(users.id, existing.id)).run();
    }
    if (!existing.emailVerifiedAt) {
      db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, existing.id)).run();
    }
    console.info(`[seed] admin sudah ada: ${email} (password tidak diubah).`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD || randomPassword(18);
  const passwordHash = await bcrypt.hash(password, 12);
  db.insert(users)
    .values({
      id: `usr_${Date.now().toString(36)}admin`,
      name: "Administrator",
      email,
      passwordHash,
      role: "admin",
      status: "active",
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();

  console.info("============================================================");
  console.info("  AKUN ADMIN DIBUAT — CATAT SEKARANG, TIDAK AKAN DICETAK ULANG");
  console.info(`  Email    : ${email}`);
  console.info(`  Password : ${password}`);
  console.info("  Segera ganti password setelah login pertama.");
  console.info("============================================================");
}

async function seedPlans() {
  const rate = Number(SETTING_DEFAULTS.usd_idr_rate);
  const markup = Number(SETTING_DEFAULTS.default_markup_percent);
  const seeds = [
    {
      name: "Starter 1GB",
      slug: "starter-1gb",
      description: "Pas untuk website ringan, bot, dan lingkungan pengembangan.",
      doSizeSlug: "s-1vcpu-1gb",
      vcpus: 1,
      ramMb: 1024,
      diskGb: 25,
      transferTb: 1,
      costMonthlyUsd: 6,
      isFeatured: false,
      sortOrder: 1,
      promo: null as number | null,
    },
    {
      name: "Basic 2GB",
      slug: "basic-2gb",
      description: "Pilihan paling populer untuk aplikasi produksi kecil dan staging.",
      doSizeSlug: "s-1vcpu-2gb",
      vcpus: 1,
      ramMb: 2048,
      diskGb: 50,
      transferTb: 2,
      costMonthlyUsd: 12,
      isFeatured: true,
      sortOrder: 2,
      promo: 239000,
    },
    {
      name: "Pro 4GB",
      slug: "pro-4gb",
      description: "Untuk aplikasi dengan trafik stabil dan beberapa layanan sekaligus.",
      doSizeSlug: "s-2vcpu-4gb",
      vcpus: 2,
      ramMb: 4096,
      diskGb: 80,
      transferTb: 4,
      costMonthlyUsd: 24,
      isFeatured: false,
      sortOrder: 3,
      promo: null as number | null,
    },
    {
      name: "Business 8GB",
      slug: "business-8gb",
      description: "Kapasitas lebih besar untuk database dan beban kerja intensif.",
      doSizeSlug: "s-4vcpu-8gb",
      vcpus: 4,
      ramMb: 8192,
      diskGb: 160,
      transferTb: 5,
      costMonthlyUsd: 48,
      isFeatured: false,
      sortOrder: 4,
      promo: null as number | null,
    },
    {
      name: "Enterprise 16GB",
      slug: "enterprise-16gb",
      description: "Performa maksimal untuk tim, API, dan layanan multi-tenant.",
      doSizeSlug: "s-8vcpu-16gb",
      vcpus: 8,
      ramMb: 16384,
      diskGb: 320,
      transferTb: 6,
      costMonthlyUsd: 96,
      isFeatured: false,
      sortOrder: 5,
      promo: null as number | null,
    },
  ];

  for (const p of seeds) {
    const existing = db.select().from(plans).where(eq(plans.slug, p.slug)).get();
    if (existing) continue;
    const monthly = roundToNineThousand(p.costMonthlyUsd * rate * (1 + markup / 100));
    db.insert(plans)
      .values({
        name: p.name,
        slug: p.slug,
        description: p.description,
        doSizeSlug: p.doSizeSlug,
        vcpus: p.vcpus,
        ramMb: p.ramMb,
        diskGb: p.diskGb,
        transferTb: p.transferTb,
        costMonthlyUsd: p.costMonthlyUsd,
        priceMonthly: monthly,
        priceWeekly: suggestedWeeklyPrice(monthly),
        priceQuarterly: Math.round((monthly * 3 * 0.95) / 1000) * 1000,
        priceYearly: Math.round((monthly * 12 * 0.83) / 1000) * 1000,
        promoPriceMonthly: p.promo,
        setupFee: 0,
        isActive: true,
        isFeatured: p.isFeatured,
        allowRegionSlugs: ["sgp1", "nyc1", "fra1"],
        sortOrder: p.sortOrder,
      })
      .run();
  }
  console.info("[seed] paket contoh siap.");
}

async function seedCatalog() {
  const regionRows = [
    { slug: "sgp1", name: "Singapore 1", country: "Singapore", pingMs: 18, sortOrder: 1 },
    { slug: "nyc1", name: "New York 1", country: "United States", pingMs: 230, sortOrder: 2 },
    { slug: "fra1", name: "Frankfurt 1", country: "Germany", pingMs: 180, sortOrder: 3 },
  ];
  for (const r of regionRows) {
    if (!db.select().from(regions).where(eq(regions.slug, r.slug)).get()) {
      db.insert(regions)
        .values({ ...r, available: true, isActive: true })
        .run();
    }
  }

  const imageRows = [
    { slug: "ubuntu-24-04-x64", name: "Ubuntu 24.04 LTS", distribution: "Ubuntu", version: "24.04", logoKey: "ubuntu" },
    { slug: "ubuntu-22-04-x64", name: "Ubuntu 22.04 LTS", distribution: "Ubuntu", version: "22.04", logoKey: "ubuntu" },
    { slug: "debian-12-x64", name: "Debian 12", distribution: "Debian", version: "12", logoKey: "debian" },
    { slug: "almalinux-9-x64", name: "AlmaLinux 9", distribution: "AlmaLinux", version: "9", logoKey: "almalinux" },
    { slug: "rocky-9-x64", name: "Rocky Linux 9", distribution: "Rocky", version: "9", logoKey: "rocky" },
  ];
  for (const i of imageRows) {
    if (!db.select().from(osImages).where(eq(osImages.slug, i.slug)).get()) {
      db.insert(osImages).values({ ...i, isActive: true }).run();
    }
  }
  console.info("[seed] region & OS siap.");
}

async function seedWa() {
  for (const [key, tpl] of Object.entries(DEFAULT_WA_TEMPLATES)) {
    if (!db.select().from(waTemplates).where(eq(waTemplates.key, key)).get()) {
      db.insert(waTemplates)
        .values({ key, title: tpl.title, body: tpl.body, isActive: true, updatedBy: "seed" })
        .run();
    }
  }
  if (!db.select().from(waState).where(eq(waState.id, "singleton")).get()) {
    db.insert(waState).values({ id: "singleton", status: "disconnected" }).run();
  }
  console.info("[seed] template WhatsApp & state siap.");
}

async function seedPromo() {
  if (db.select().from(promoCodes).where(eq(promoCodes.code, "HEMAT10")).get()) return;
  db.insert(promoCodes)
    .values({
      code: "HEMAT10",
      type: "percent",
      value: 10,
      maxDiscount: 100000,
      minAmount: 100000,
      quota: 100,
      usedCount: 0,
      startsAt: new Date(Date.now() - 86400000),
      endsAt: new Date(Date.now() + 30 * 86400000),
      isActive: true,
    })
    .run();
  console.info("[seed] kode promo contoh HEMAT10 siap.");
}

async function main() {
  console.info("[seed] mulai…");
  await seedSettings();
  await seedAdmin();
  await seedPlans();
  await seedCatalog();
  await seedWa();
  await seedPromo();
  console.info("[seed] selesai. Jalankan `npm run dev` lalu login.");
}

main().catch((error) => {
  console.error("[seed] gagal", error);
  process.exit(1);
});
