/**
 * Smoke test alur inti tanpa browser:
 * pesan VPS → bayar saldo → provisioning mock → layanan aktif.
 *
 * Jalankan: npx tsx --conditions=react-server scripts/smoke.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/core";
import {
  balanceTransactions,
  invoices,
  jobs,
  osImages,
  plans,
  regions,
  services,
  users,
} from "@/lib/db/schema";
import { createOrder } from "@/server/services/orders";
import { settleInvoice } from "@/server/services/billing";
import { processDueJobs } from "@/server/services/provisioning";
import { hashPassword } from "@/lib/password";
import { decrypt } from "@/lib/crypto";

const TEST_USER_ID = "usr_smoke_test";
const PHONE = "628111222333";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`GAGAL: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function cleanup() {
  const serviceRows = db.select().from(services).where(eq(services.userId, TEST_USER_ID)).all();
  for (const service of serviceRows) {
    db.delete(jobs).where(eq(jobs.refId, service.id)).run();
  }
  db.delete(users).where(eq(users.id, TEST_USER_ID)).run();
}

async function main() {
  await cleanup();
  console.log("[smoke] menyiapkan pengguna uji…");
  db.insert(users)
    .values({
      id: TEST_USER_ID,
      name: "Smoke Tester",
      email: "smoke@example.test",
      phone: PHONE,
      passwordHash: await hashPassword("Smoke#12345"),
      emailVerifiedAt: new Date(),
      balance: 5_000_000,
    })
    .run();

  const plan = db.select().from(plans).all().find((row) => row.isActive);
  assert(plan, "ada paket aktif");
  const region = db
    .select()
    .from(regions)
    .all()
    .find((row) => row.isActive && row.available && plan!.allowRegionSlugs.includes(row.slug));
  assert(region, "ada region yang diizinkan paket");
  const image = db.select().from(osImages).all().find((row) => row.isActive);
  assert(image, "ada OS image aktif");

  console.log("[smoke] membuat pesanan…");
  const { order, invoice } = await createOrder(
    {
      planId: plan!.id,
      regionSlug: region!.slug,
      osSlug: image!.slug,
      hostname: "smoke-test",
      billingCycle: "monthly",
      promoCode: "",
      paymentMethod: "manual",
      sshMode: "password",
      sshKeyId: undefined,
      newSshKeyName: undefined,
      newSshKeyPublic: undefined,
    } as Parameters<typeof createOrder>[0],
    TEST_USER_ID,
  );
  assert(invoice.amount === order.priceSnapshot.total, "nominal invoice sama dengan snapshot");
  assert(invoice.status === "unpaid", "invoice awal belum dibayar");

  console.log("[smoke] membayar dengan saldo…");
  await settleInvoice({
    invoiceId: invoice.id,
    provider: "balance",
    method: "smoke",
    providerRef: `SMOKE-${invoice.invoiceNumber}`,
    deductBalance: true,
  });
  const paidInvoice = db.select().from(invoices).where(eq(invoices.id, invoice.id)).get()!;
  assert(paidInvoice.status === "paid", "invoice menjadi lunas");
  const service = db.select().from(services).where(eq(services.orderId, order.id)).get();
  assert(service, "layanan provision dibuat");
  const debit = db
    .select()
    .from(balanceTransactions)
    .all()
    .find((row) => row.userId === TEST_USER_ID && row.type === "payment");
  assert(debit && debit.amount === -invoice.amount, "saldo terpotong sesuai invoice");

  console.log("[smoke] menjalankan provisioning mock…");
  for (let pass = 0; pass < 4; pass++) {
    const job = db.select().from(jobs).where(eq(jobs.refId, service!.id)).get();
    if (!job || job.status === "done") break;
    db.update(jobs).set({ notBefore: new Date(Date.now() - 1000) }).where(eq(jobs.id, job.id)).run();
    await processDueJobs(5);
  }
  const activeService = db.select().from(services).where(eq(services.id, service!.id)).get()!;
  assert(activeService.status === "active", "layanan aktif setelah provisioning");
  assert(Boolean(activeService.ipv4?.startsWith("203.0.113.")), "IP mock sesuai rentang dokumentasi");
  assert(Boolean(activeService.rootPasswordEncrypted), "password root tersimpan terenkripsi");
  const password = decrypt(activeService.rootPasswordEncrypted!);
  assert(password.length >= 12, "password root dapat didekripsi");

  const finalOrder = db.select().from(invoices).where(eq(invoices.id, invoice.id)).get()!;
  assert(finalOrder.status === "paid", "invoice tetap lunas (idempoten)");

  console.log("[smoke] membersihkan data uji…");
  await cleanup();
  console.log("[smoke] SEMUA LULUS");
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
