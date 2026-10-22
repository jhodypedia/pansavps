import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { osImages, plans, regions, sshKeys } from "@/lib/db/schema";
import { isUserVerified, requireUser } from "@/lib/auth";
import { availableProviders } from "@/lib/payments";
import { listTripayChannels } from "@/lib/payments/tripay";
import { PageHeader } from "@/components/shared/page-header";
import { CheckoutWizard } from "@/components/dashboard/checkout-wizard";
import { VerificationRequired } from "@/components/dashboard/verification-required";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Pesan VPS Baru" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ paket?: string; plan?: string }>;
}) {
  const user = await requireUser();
  const { paket, plan: planParam } = await searchParams;
  const verified = isUserVerified(user);

  const planRows = db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.sortOrder), asc(plans.priceMonthly))
    .all();
  const regionRows = db.select().from(regions).where(eq(regions.isActive, true)).all();
  const imageRows = db.select().from(osImages).where(eq(osImages.isActive, true)).all();
  const keyRows = db.select().from(sshKeys).where(eq(sshKeys.userId, user.id)).all();
  const providers = availableProviders();
  const tripayChannels = await listTripayChannels();
  const selectedSlug = paket ?? planParam;
  const initialPlan = planRows.find((plan) => plan.slug === selectedSlug) ?? planRows[0];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Pesanan", href: "/dashboard/pesanan" },
          { label: "Pesan baru" },
        ]}
        title="Pesan VPS baru"
        description="Pilih paket, region, sistem operasi, dan metode pembayaran. Server aktif otomatis setelah pembayaran terkonfirmasi."
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/dashboard/pesanan">
              <ArrowLeft className="size-4" /> Kembali
            </Link>
          </Button>
        }
      />

      {!verified ? (
        <VerificationRequired
          title="Verifikasi akun untuk memesan VPS"
          description="Kode verifikasi dikirim ke WhatsApp (prioritas). Jika SMTP aktif, tautan verifikasi juga dikirim ke email. Setelah terverifikasi, kamu bisa langsung memesan."
        />
      ) : null}

      {!verified && !user.phone ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 text-[#D97706]" />
            <div>
              <p className="text-sm font-bold text-[#92400E]">Nomor WhatsApp belum diisi</p>
              <p className="text-xs text-[#92400E]/80">
                Nomor WhatsApp wajib diisi untuk menerima kode verifikasi dan data akses layanan.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Link href="/dashboard/pengaturan">Lengkapi profil</Link>
          </Button>
        </div>
      ) : null}

      {verified ? (
        <CheckoutWizard
          plans={planRows.map((plan) => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            vcpus: plan.vcpus,
            ramMb: plan.ramMb,
            diskGb: plan.diskGb,
            transferTb: plan.transferTb,
            priceMonthly: plan.priceMonthly,
            priceWeekly: plan.priceWeekly,
            promoPriceMonthly: plan.promoPriceMonthly,
            priceQuarterly: plan.priceQuarterly,
            priceYearly: plan.priceYearly,
            setupFee: plan.setupFee,
            allowRegionSlugs: plan.allowRegionSlugs,
            isFeatured: plan.isFeatured,
          }))}
          regions={regionRows.map((region) => ({
            slug: region.slug,
            name: region.name,
            country: region.country,
            pingMs: region.pingMs,
          }))}
          images={imageRows.map((image) => ({
            slug: image.slug,
            name: image.name,
            distribution: image.distribution,
            version: image.version,
          }))}
          sshKeys={keyRows.map((key) => ({
            id: key.id,
            name: key.name,
            fingerprint: key.fingerprint,
          }))}
          providers={providers.map((provider) => ({
            id: provider.id,
            label: provider.label,
            description: provider.description,
          }))}
          tripayChannels={tripayChannels}
          balance={user.balance}
          initialPlanId={initialPlan?.id}
        />
      ) : null}
    </div>
  );
}
