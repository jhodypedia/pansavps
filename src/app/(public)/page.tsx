import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock,
  Cloud,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  Headphones,
  KeyRound,
  LayoutDashboard,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { plans, regions } from "@/lib/db/schema";
import { getPublicBrand } from "@/lib/settings";
import { cycleUnitPrice, promoDiscountPercent } from "@/lib/pricing";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/shared/reveal";
import { StatusBadge } from "@/components/shared/status-badge";

const features = [
  {
    icon: Zap,
    title: "Aktivasi otomatis",
    body: "Setelah pembayaran terverifikasi, server langsung dibuat dan dikonfigurasi tanpa menunggu admin.",
  },
  {
    icon: LayoutDashboard,
    title: "Panel kontrol lengkap",
    body: "Nyalakan, reboot, reset password, rebuild OS, snapshot, dan pantau spesifikasi dari satu dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Pembayaran aman",
    body: "Transfer manual terverifikasi dan Tripay. Setiap transaksi tercatat dan idempoten.",
  },
  {
    icon: Wallet,
    title: "Saldo & perpanjangan",
    body: "Top up saldo, bayar instan, dan aktifkan perpanjangan otomatis agar layanan tidak terputus.",
  },
  {
    icon: Globe2,
    title: "Region pilihan",
    body: "Singapore untuk latensi rendah di Indonesia, plus New York dan Frankfurt untuk jangkauan global.",
  },
  {
    icon: Headphones,
    title: "Support WhatsApp",
    body: "Tiket di dashboard dan notifikasi WhatsApp untuk setiap perubahan status layanan.",
  },
];

const steps = [
  {
    title: "Pilih paket & region",
    body: "Tentukan RAM, CPU, storage, region, dan sistem operasi. Harga tampil transparan tanpa biaya tersembunyi.",
  },
  {
    title: "Bayar dengan cara favoritmu",
    body: "Saldo, transfer bank, atau Tripay. Invoice dan status pembayaran langsung terlihat di dashboard.",
  },
  {
    title: "Server aktif otomatis",
    body: "Kredensial root dikirim ke email dan WhatsApp. Kelola server kapan saja dari panel kontrol.",
  },
];

const faqs = [
  {
    q: "Berapa lama VPS aktif setelah pembayaran?",
    a: "Pembayaran saldo dan gateway yang terkonfirmasi otomatis akan memicu provisioning segera. Umumnya server aktif dalam hitungan detik hingga beberapa menit, tergantung region dan sistem operasi. Transfer manual menunggu verifikasi admin maksimal 1x24 jam pada hari kerja.",
  },
  {
    q: "Apakah saya mendapatkan akses root?",
    a: "Ya. Setiap VPS memberikan akses root penuh. Kamu bisa memilih login dengan password yang dibuat sistem atau menggunakan SSH key milikmu sendiri.",
  },
  {
    q: "Bisakah upgrade paket tanpa kehilangan data?",
    a: "Upgrade dilakukan dengan resize droplet sehingga data tetap tersimpan. Biaya upgrade dihitung prorata berdasarkan sisa masa aktif. Tetap lakukan backup penting sebelum perubahan besar.",
  },
  {
    q: "Apa yang terjadi jika masa aktif berakhir?",
    a: "Layanan ditangguhkan setelah jatuh tempo, lalu dihapus otomatis setelah masa tenggang berakhir. Kamu akan menerima pengingat melalui email dan WhatsApp sebelum jatuh tempo.",
  },
  {
    q: "Metode pembayaran apa saja yang didukung?",
    a: "Transfer bank manual dan Tripay (QRIS & virtual account). Ketersediaan metode mengikuti pengaturan admin dan akan tampil otomatis saat checkout.",
  },
  {
    q: "Apakah ada garansi uang kembali?",
    a: "Jika provisioning gagal karena masalah di sisi kami, dana dapat dikembalikan sebagai saldo akun. Lihat kebijakan refund untuk ketentuan lengkapnya.",
  },
];

function PlanCard({
  plan,
  featured,
}: {
  plan: typeof plans.$inferSelect;
  featured?: boolean;
}) {
  const price = cycleUnitPrice(plan, "monthly");
  const discount = promoDiscountPercent(plan);
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border p-6 ${
        featured ? "border-[#0B3D2E] bg-[#0B3D2E] text-white" : "border-[#E3E8E4] bg-white"
      }`}
    >
      {featured ? (
        <span className="absolute -top-3 left-6 rounded-full bg-[#16A34A] px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
          Paling populer
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`font-display text-lg font-bold ${featured ? "text-white" : "text-[#101613]"}`}>
            {plan.name}
          </h3>
          <p className={`mt-1 text-sm ${featured ? "text-white/65" : "text-[#5B6B60]"}`}>{plan.description}</p>
        </div>
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
            featured ? "bg-white/10 text-white" : "bg-[#E7F4EC] text-[#0B3D2E]"
          }`}
        >
          <Server className="size-5" />
        </span>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <span className={`font-display text-3xl font-bold ${featured ? "text-white" : "text-[#101613]"}`}>
          {formatIDR(price)}
        </span>
        <span className={`pb-1 text-sm ${featured ? "text-white/60" : "text-[#5B6B60]"}`}>/bulan</span>
      </div>
      {discount > 0 ? (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className={featured ? "text-white/50 line-through" : "text-[#8A9A90] line-through"}>
            {formatIDR(plan.priceMonthly)}
          </span>
          <span className="rounded-full bg-[#16A34A]/15 px-2 py-0.5 font-bold text-[#16A34A]">
            Hemat {discount}%
          </span>
        </div>
      ) : (
        <div className="mt-1 text-xs text-transparent select-none">.</div>
      )}

      <ul className={`mt-5 flex flex-col gap-2.5 text-sm ${featured ? "text-white/80" : "text-[#5B6B60]"}`}>
        <li className="flex items-center gap-2">
          <Cpu className="size-4 shrink-0" /> {plan.vcpus} vCPU
        </li>
        <li className="flex items-center gap-2">
          <Database className="size-4 shrink-0" /> {plan.ramMb / 1024} GB RAM
        </li>
        <li className="flex items-center gap-2">
          <HardDrive className="size-4 shrink-0" /> {plan.diskGb} GB SSD
        </li>
        <li className="flex items-center gap-2">
          <Globe2 className="size-4 shrink-0" /> {plan.transferTb} TB transfer
        </li>
      </ul>

      <div className="mt-auto pt-6">
        <Button
          asChild
          className={
            featured
              ? "w-full bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]"
              : "w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
          }
        >
          <Link href={`/register?plan=${plan.slug}`}>
            Pesan {plan.name} <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const brand = getPublicBrand();
  const availablePlans = db.select().from(plans).all().filter((p) => p.isActive);
  availablePlans.sort((a, b) => a.sortOrder - b.sortOrder);
  const featured = availablePlans.filter((p) => p.isFeatured).slice(0, 1);
  const showcase = [...featured, ...availablePlans.filter((p) => !p.isFeatured)].slice(0, 3);
  const regionRows = db.select().from(regions).all().filter((r) => r.isActive);
  const cheapest = availablePlans.length
    ? Math.min(...availablePlans.map((p) => cycleUnitPrice(p, "monthly")))
    : 0;

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: brand.siteName,
        url: base,
        description: brand.description,
        email: brand.supportEmail,
        contactPoint: {
          "@type": "ContactPoint",
          telephone: `+${brand.supportWhatsapp}`,
          contactType: "customer support",
          availableLanguage: ["id"],
        },
      },
      {
        "@type": "WebSite",
        name: brand.siteName,
        url: base,
        inLanguage: "id-ID",
      },
      ...availablePlans.slice(0, 8).map((plan) => ({
        "@type": "Product",
        name: plan.name,
        description: plan.description || `VPS ${plan.name} dengan ${plan.vcpus} vCPU dan ${plan.ramMb / 1024} GB RAM.`,
        brand: { "@type": "Brand", name: brand.siteName },
        offers: {
          "@type": "Offer",
          price: cycleUnitPrice(plan, "monthly"),
          priceCurrency: "IDR",
          availability: "https://schema.org/InStock",
          url: `${base}/pricing`,
        },
      })),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* Hero */}
      <section className="border-b border-[#E3E8E4] bg-[#0B3D2E] text-white">
        <div className="ws-container grid gap-12 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="size-1.5 rounded-full bg-[#4ADE80]" />
              DigitalOcean · Aktivasi otomatis
            </div>
            <h1 className="mt-6 max-w-2xl font-display text-4xl leading-[1.08] font-bold tracking-tight text-white sm:text-5xl lg:text-[56px]">
              VPS cepat untuk ide yang tidak bisa menunggu.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              {brand.tagline} Pilih paket, bayar, dan server siap dipakai. Panel kontrol lengkap, support
              WhatsApp, dan harga transparan dalam rupiah.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
                <Link href="/register">
                  Mulai dari {formatIDR(cheapest)} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/pricing">Lihat semua paket</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                { k: "Aktivasi", v: "< 2 mnt" },
                { k: "Region", v: `${regionRows.length} wilayah` },
                { k: "Support", v: "24/7" },
                { k: "Root akses", v: "Penuh" },
              ].map((item) => (
                <div key={item.k}>
                  <dt className="text-[11px] font-medium tracking-wide text-white/50 uppercase">{item.k}</dt>
                  <dd className="mt-1 font-display text-lg font-bold text-white">{item.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Reveal className="relative">
            <div className="rounded-2xl border border-white/15 bg-[#06231A] p-1.5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#F87171]" />
                  <span className="size-2.5 rounded-full bg-[#FBBF24]" />
                  <span className="size-2.5 rounded-full bg-[#4ADE80]" />
                </div>
                <span className="font-mono text-[11px] text-white/40">pansa — deploy</span>
              </div>
              <div className="space-y-4 p-5 font-mono text-[13px] leading-relaxed">
                <p className="text-[#86EFAC]">$ pansa deploy basic-2gb --region sgp1</p>
                <div className="space-y-2 text-white/65">
                  <p>
                    <span className="text-[#4ADE80]">✓</span> Pembayaran terverifikasi
                  </p>
                  <p>
                    <span className="text-[#4ADE80]">✓</span> Droplet dibuat · sgp1
                  </p>
                  <p>
                    <span className="text-[#4ADE80]">✓</span> Kredensial dikirim ke WhatsApp
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white/45">hostname</span>
                    <span className="text-white">app-prod-01</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-white/45">ipv4</span>
                    <span className="text-white">203.0.113.42</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-white/45">status</span>
                    <span className="inline-flex items-center gap-1.5 text-[#86EFAC]">
                      <span className="size-1.5 rounded-full bg-[#4ADE80]" /> aktif
                    </span>
                  </div>
                </div>
                <p className="text-white/35">selesai dalam 12 detik · 2 vCPU · 2 GB RAM</p>
              </div>
            </div>
            <div className="absolute -bottom-3 -left-3 hidden rounded-xl border border-white/15 bg-[#0E4D38] px-4 py-3 text-xs text-white sm:block">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#86EFAC]" /> Pembayaran terenkripsi & idempoten
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Value strip */}
      <section className="border-b border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Clock, text: "Aktivasi otomatis tanpa antrean manual" },
            { icon: Lock, text: "Secret gateway disimpan terenkripsi" },
            { icon: RefreshCw, text: "Perpanjangan otomatis dari saldo" },
            { icon: KeyRound, text: "SSH key & password root aman" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2.5 text-sm text-[#5B6B60]">
              <item.icon className="size-4 shrink-0 text-[#0B3D2E]" /> {item.text}
            </div>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="section-pad">
        <div className="ws-container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge className="border border-[#CFE6D8] bg-[#E7F4EC] text-[#0B3D2E] hover:bg-[#E7F4EC]">
              Harga transparan
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">
              Paket yang tumbuh bersama kamu
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#5B6B60]">
              Semua paket sudah termasuk akses root, IPv4, dan panel kontrol. Harga bulanan dalam rupiah,
              tanpa biaya tersembunyi.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {showcase.map((plan, index) => (
              <Reveal key={plan.id} delay={index * 0.06} className="h-full">
                <PlanCard plan={plan} featured={plan.isFeatured} />
              </Reveal>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white text-[#0B3D2E] hover:bg-[#F3F9F5]">
              <Link href="/pricing">
                Bandingkan semua paket <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container section-pad">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <Reveal>
              <Badge className="border border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-white">Fitur</Badge>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">
                Semua yang dibutuhkan untuk menjalankan server
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#5B6B60]">
                Dari deployment pertama sampai operasional harian. Kontrol penuh tanpa harus menyentuh
                panel pihak ketiga.
              </p>
              <div className="mt-6 rounded-2xl border border-[#D8E2DB] bg-white p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#101613]">
                  <Cloud className="size-4 text-[#0B3D2E]" /> Infrastruktur DigitalOcean
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">
                  Droplet di region pilihan dengan monitoring aktif. Mode mock tersedia untuk pengujian
                  alur tanpa memakai kredit cloud.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {regionRows.map((region) => (
                    <span
                      key={region.slug}
                      className="rounded-full border border-[#E3E8E4] bg-[#FBFCFB] px-2.5 py-1 text-xs font-medium text-[#5B6B60]"
                    >
                      {region.name}
                      {region.pingMs ? ` · ${region.pingMs} ms` : ""}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature, index) => (
                <Reveal key={feature.title} delay={index * 0.04}>
                  <div className="card-lift h-full rounded-2xl border border-[#E3E8E4] bg-white p-5">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                      <feature.icon className="size-5" />
                    </span>
                    <h3 className="mt-4 text-base font-bold text-[#101613]">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#5B6B60]">{feature.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section-pad">
        <div className="ws-container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge className="border border-[#CFE6D8] bg-[#E7F4EC] text-[#0B3D2E] hover:bg-[#E7F4EC]">
              Cara kerja
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">
              Tiga langkah, server siap
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.07}>
                <div className="relative h-full rounded-2xl border border-[#E3E8E4] bg-white p-6">
                  <span className="font-display text-5xl font-bold text-[#DCF0E3]">0{index + 1}</span>
                  <h3 className="mt-3 text-lg font-bold text-[#101613]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Control panel preview */}
      <section className="border-y border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <Reveal>
            <Badge className="border border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-white">
              Panel kontrol
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">
              Kelola server tanpa buka tiket
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#5B6B60]">
              Status server, kredensial, snapshot, dan riwayat aksi tersedia dalam satu tempat. Semua aksi
              tercatat untuk keamanan.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {[
                "Reset password root dengan sekali klik",
                "Rebuild OS dan snapshot on-demand",
                "Lihat IP, spesifikasi, dan masa aktif",
                "Riwayat aksi lengkap dengan status",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#101613]">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E7F4EC] text-[#0B3D2E]">
                    <Check className="size-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-7 bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href="/fitur">
                Jelajahi fitur <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-2xl border border-[#D8E2DB] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#E3E8E4] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-[#0B3D2E] text-white">
                    <Server className="size-3.5" />
                  </span>
                  <span className="text-sm font-bold text-[#101613]">app-prod-01</span>
                </div>
                <StatusBadge status="active" label="Aktif" />
              </div>
              <div className="grid grid-cols-2 gap-px bg-[#E3E8E4]">
                {[
                  { k: "IP Address", v: "203.0.113.42" },
                  { k: "Region", v: "Singapore 1" },
                  { k: "Spesifikasi", v: "2 vCPU · 4 GB" },
                  { k: "Storage", v: "80 GB SSD" },
                  { k: "Sistem operasi", v: "Ubuntu 24.04" },
                  { k: "Jatuh tempo", v: "12 Nov 2026" },
                ].map((item) => (
                  <div key={item.k} className="bg-white p-4">
                    <p className="text-xs text-[#5B6B60]">{item.k}</p>
                    <p className="mt-1 text-sm font-semibold text-[#101613]">{item.v}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-[#E3E8E4] p-4">
                {["Power on", "Reboot", "Snapshot", "Reset password"].map((action) => (
                  <span
                    key={action}
                    className="rounded-lg border border-[#E3E8E4] bg-[#FBFCFB] px-3 py-1.5 text-xs font-medium text-[#5B6B60]"
                  >
                    {action}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-pad">
        <div className="ws-container grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <Reveal>
            <Badge className="border border-[#CFE6D8] bg-[#E7F4EC] text-[#0B3D2E] hover:bg-[#E7F4EC]">FAQ</Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">
              Pertanyaan yang sering diajukan
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#5B6B60]">
              Tidak menemukan jawaban? Hubungi support melalui WhatsApp atau buka tiket di dashboard.
            </p>
            <Button asChild variant="outline" className="mt-5 border-[#D8E2DB] bg-white text-[#0B3D2E]">
              <Link href="/kontak">Hubungi kami</Link>
            </Button>
          </Reveal>
          <Reveal delay={0.06}>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.q} value={`faq-${index}`} className="border-[#E3E8E4]">
                  <AccordionTrigger className="text-left text-[15px] font-semibold text-[#101613] hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-[#5B6B60]">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0B3D2E]">
        <div className="ws-container flex flex-col items-start justify-between gap-6 py-14 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Siap menjalankan server pertamamu?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
              Daftar gratis, pilih paket, dan bayar dengan metode yang paling nyaman. Tanpa kontrak jangka
              panjang.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
              <Link href="/register">
                Buat akun <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/pricing">Lihat harga</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
