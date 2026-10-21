import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Check,
  Clock,
  Cloud,
  Code2,
  CreditCard,
  Gauge,
  Globe2,
  Headphones,
  KeyRound,
  LayoutDashboard,
  Lock,
  MousePointerClick,
  RefreshCw,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { osImages, plans, regions } from "@/lib/db/schema";
import { getPublicBrand } from "@/lib/settings";
import { cycleUnitPrice } from "@/lib/pricing";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CountUp } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { ScrollProgress } from "@/components/shared/scroll-progress";
import { StatusBadge } from "@/components/shared/status-badge";
import { HomePlanPreview } from "@/components/public/home-plan-preview";

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
    icon: MousePointerClick,
    tag: "Pilih",
    title: "Pilih paket & region",
    body: "Tentukan RAM, CPU, storage, region, dan sistem operasi. Harga tampil transparan tanpa biaya tersembunyi.",
  },
  {
    icon: CreditCard,
    tag: "Bayar",
    title: "Bayar dengan cara favoritmu",
    body: "Saldo, transfer bank, atau Tripay. Invoice dan status pembayaran langsung terlihat di dashboard.",
  },
  {
    icon: Rocket,
    tag: "Aktif",
    title: "Server aktif otomatis",
    body: "Kredensial root dikirim ke email dan WhatsApp. Kelola server kapan saja dari panel kontrol.",
  },
];

const useCases = [
  {
    icon: Code2,
    title: "Developer & startup",
    body: "Deploy aplikasi, API, dan environment staging tanpa mengurus server fisik.",
    points: ["Akses root penuh", "SSH key atau password", "Snapshot sebelum rilis"],
  },
  {
    icon: Store,
    title: "UMKM & toko online",
    body: "Website, katalog, dan bot operasional tetap ringan dengan resource yang pas.",
    points: ["Aktivasi cepat", "Harga rupiah transparan", "Pengingat masa aktif"],
  },
  {
    icon: Briefcase,
    title: "Agency & freelancer",
    body: "Kelola server beberapa klien dari satu dashboard yang rapi dan tercatat.",
    points: ["Beberapa region", "Riwayat aksi", "Support via WhatsApp"],
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
    a: "Layanan ditangguhkan setelah jatuh tempo. Kamu akan menerima pengingat melalui email dan WhatsApp sebelum jatuh tempo.",
  },
  {
    q: "Apakah tersedia paket mingguan?",
    a: "Ya. Paket mingguan aktif selama 7 hari. Kamu akan menerima pengingat H-1 untuk memperpanjang jika masih membutuhkan server.",
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

export default async function HomePage() {
  const brand = getPublicBrand();
  const availablePlans = db.select().from(plans).all().filter((p) => p.isActive);
  availablePlans.sort((a, b) => a.sortOrder - b.sortOrder);
  const featured = availablePlans.filter((p) => p.isFeatured).slice(0, 1);
  const showcase = [...featured, ...availablePlans.filter((p) => !p.isFeatured)].slice(0, 3);
  const regionRows = db.select().from(regions).all().filter((r) => r.isActive);
  const osRows = db.select().from(osImages).all().filter((o) => o.isActive);
  const osNames = [...new Set(osRows.map((o) => o.distribution))];
  const cheapest = availablePlans.length
    ? Math.min(...availablePlans.map((p) => cycleUnitPrice(p, "monthly")))
    : 0;
  const weeklyCheapest = availablePlans.length
    ? Math.min(...availablePlans.map((p) => cycleUnitPrice(p, "weekly")))
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
      ...availablePlans.slice(0, 8).map((plan) => {
        const monthly = cycleUnitPrice(plan, "monthly");
        const weekly = cycleUnitPrice(plan, "weekly");
        return {
          "@type": "Product",
          name: plan.name,
          description:
            plan.description ||
            `VPS ${plan.name} dengan ${plan.vcpus} vCPU dan ${plan.ramMb / 1024} GB RAM.`,
          brand: { "@type": "Brand", name: brand.siteName },
          offers: [
            {
              "@type": "Offer",
              name: "Bulanan",
              price: monthly,
              priceCurrency: "IDR",
              availability: "https://schema.org/InStock",
              url: `${base}/pricing`,
            },
            ...(weekly > 0
              ? [
                  {
                    "@type": "Offer",
                    name: "Mingguan",
                    price: weekly,
                    priceCurrency: "IDR",
                    availability: "https://schema.org/InStock",
                    url: `${base}/pricing`,
                  },
                ]
              : []),
          ],
        };
      }),
    ],
  };

  return (
    <>
      <ScrollProgress />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10 bg-[#06231A] text-white">
        <div className="hero-aurora pointer-events-none absolute inset-0" aria-hidden />
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div
          className="floating-orb pointer-events-none absolute -left-16 top-24 size-44 bg-[#22C55E]/25"
          aria-hidden
        />
        <div
          className="floating-orb floating-orb-delay pointer-events-none absolute right-10 top-16 size-28 bg-[#86EFAC]/20"
          aria-hidden
        />
        <div
          className="floating-orb pointer-events-none absolute bottom-10 right-1/3 size-36 bg-[#16A34A]/20"
          style={{ animationDelay: "0.7s" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.24) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.24) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "linear-gradient(to bottom, black, transparent 88%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 88%)",
          }}
          aria-hidden
        />

        <div className="ws-container relative grid gap-14 py-16 md:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/75 backdrop-blur">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#4ADE80] shadow-[0_0_0_4px_rgba(74,222,128,0.12)]" />
                Aktivasi otomatis
              </span>
              <span className="h-3 w-px bg-white/20" />
              <span className="text-[#86EFAC]">VPS mingguan tersedia</span>
            </div>

            <h1 className="mt-6 max-w-2xl font-display text-4xl leading-[1.06] font-bold tracking-tight text-white sm:text-5xl lg:text-[58px]">
              VPS cepat untuk ide yang{" "}
              <span className="gradient-text">tidak bisa menunggu.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              {brand.tagline} Pilih paket, bayar, dan server siap dipakai. Panel kontrol lengkap, support
              WhatsApp, dan harga transparan dalam rupiah.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="shimmer-btn bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
                <Link href="/register">
                  Mulai dari {formatIDR(cheapest)} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/[0.03] text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/pricing">
                  Lihat semua paket <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/45">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#86EFAC]" /> Tanpa biaya setup
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#86EFAC]" /> Tanpa kontrak jangka panjang
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#86EFAC]" /> Bayar dalam rupiah
              </span>
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {[
                { k: "Mulai dari", v: formatIDR(cheapest) },
                { k: "Region", v: `${regionRows.length} wilayah` },
                { k: "Aktivasi", v: "< 2 menit" },
                { k: "Support", v: "24/7" },
              ].map((item) => (
                <div key={item.k}>
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase">{item.k}</dt>
                  <dd className="mt-1 font-display text-base font-bold text-white">
                    {item.k === "Region" ? (
                      <CountUp value={regionRows.length} suffix=" wilayah" />
                    ) : item.k === "Aktivasi" ? (
                      <>
                        {"< "}
                        <CountUp value={2} suffix=" menit" />
                      </>
                    ) : (
                      item.v
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <Reveal className="relative lg:pl-4">
            <div
              className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-[#16A34A]/10 blur-3xl"
              aria-hidden
            />
            <div className="relative rounded-[1.8rem] border border-white/15 bg-white/[0.06] p-2 shadow-[0_32px_90px_-36px_rgba(0,0,0,0.9)] backdrop-blur">
              <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#071D15]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#F87171]" />
                    <span className="size-2.5 rounded-full bg-[#FBBF24]" />
                    <span className="size-2.5 rounded-full bg-[#4ADE80]" />
                  </div>
                  <span className="font-mono text-[11px] text-white/35">pansa — deploy</span>
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

                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/40">hostname</span>
                      <span className="text-white">app-prod-01</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-white/40">ipv4</span>
                      <span className="text-white">203.0.113.42</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-white/40">status</span>
                      <span className="inline-flex items-center gap-1.5 text-[#86EFAC]">
                        <span className="size-1.5 animate-soft-pulse rounded-full bg-[#4ADE80]" /> aktif
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-[#16A34A] to-[#86EFAC]" />
                  </div>
                  <p className="flex items-center justify-between text-[11px] text-white/35">
                    <span>provisioning selesai</span>
                    <span className="text-[#86EFAC]">100%</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-3 hidden items-center gap-2 rounded-xl border border-white/15 bg-[#0E4D38] px-3.5 py-2.5 text-xs text-white shadow-xl sm:flex">
              <span className="flex size-6 items-center justify-center rounded-full bg-[#4ADE80]/15 text-[#86EFAC]">
                <Gauge className="size-3.5" />
              </span>
              <span>
                <span className="block font-semibold">Siap dalam hitungan detik</span>
                <span className="block text-[10px] text-white/45">tanpa antrean manual</span>
              </span>
            </div>

            <div className="absolute -bottom-4 -left-3 hidden items-center gap-2 rounded-xl border border-white/15 bg-[#0E4D38] px-3.5 py-2.5 text-xs text-white shadow-xl sm:flex">
              <ShieldCheck className="size-4 text-[#86EFAC]" />
              Pembayaran terenkripsi &amp; idempoten
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust strip */}
      <section className="overflow-hidden border-b border-[#E3E8E4] bg-white">
        <div className="marquee-track gap-3 py-5">
          {[
            { icon: Clock, title: "Aktivasi otomatis", body: "Tanpa antrean manual" },
            { icon: Lock, title: "Pembayaran aman", body: "Gateway & verifikasi manual" },
            { icon: RefreshCw, title: "Perpanjangan otomatis", body: "Dari saldo akun" },
            { icon: KeyRound, title: "Root access", body: "SSH key atau password" },
            { icon: ShieldCheck, title: "Snapshot", body: "Backup sebelum rilis" },
            { icon: Globe2, title: "Multi-region", body: "SGP, NYC, FRA" },
          ]
            .concat([
              { icon: Clock, title: "Aktivasi otomatis", body: "Tanpa antrean manual" },
              { icon: Lock, title: "Pembayaran aman", body: "Gateway & verifikasi manual" },
              { icon: RefreshCw, title: "Perpanjangan otomatis", body: "Dari saldo akun" },
              { icon: KeyRound, title: "Root access", body: "SSH key atau password" },
              { icon: ShieldCheck, title: "Snapshot", body: "Backup sebelum rilis" },
              { icon: Globe2, title: "Multi-region", body: "SGP, NYC, FRA" },
            ])
            .map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="flex min-w-[250px] items-center gap-3 rounded-xl border border-[#E8EEEA] bg-[#FBFCFB] px-4 py-2.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F3F9F5] text-[#0B3D2E]">
                  <item.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[#101613]">{item.title}</span>
                  <span className="block text-xs text-[#8A9A90]">{item.body}</span>
                </span>
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
              <span className="gradient-text">Pilih ukuran</span>, bukan kompromi.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#5B6B60]">
              Mulai dari <strong className="text-[#101613]">{formatIDR(cheapest)}/bulan</strong>
              {weeklyCheapest > 0 ? (
                <>
                  {" "}
                  atau <strong className="text-[#101613]">{formatIDR(weeklyCheapest)}/minggu</strong>
                </>
              ) : null}
              . Semua paket sudah termasuk akses root, IPv4, dan panel kontrol.
            </p>
          </Reveal>

          <HomePlanPreview plans={showcase} />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white text-[#0B3D2E] hover:bg-[#F3F9F5]">
              <Link href="/pricing">
                Bandingkan semua paket <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="text-[#5B6B60] hover:bg-[#F3F9F5] hover:text-[#0B3D2E]">
              <Link href="/faq">Punya pertanyaan? Baca FAQ</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container section-pad">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <Reveal className="lg:sticky lg:top-24">
              <Badge className="border border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-white">
                Kenapa PansaVPS
              </Badge>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">
                Kontrol penuh, tanpa ribet.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#5B6B60]">
                Dari deployment pertama sampai operasional harian. Kontrol penuh tanpa harus menyentuh
                panel pihak ketiga.
              </p>

              <div className="mt-7 rounded-2xl border border-[#D8E2DB] bg-white p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#101613]">
                  <Cloud className="size-4 text-[#0B3D2E]" /> Infrastruktur cloud
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
                {osNames.length ? (
                  <div className="mt-4 border-t border-[#EDF1EE] pt-4">
                    <p className="text-[11px] font-semibold tracking-wide text-[#8A9A90] uppercase">
                      Sistem operasi tersedia
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {osNames.slice(0, 6).map((name) => (
                        <span
                          key={name}
                          className="rounded-md bg-[#F3F9F5] px-2 py-1 text-[11px] font-medium text-[#0B3D2E]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature, index) => (
                <Reveal key={feature.title} delay={index * 0.04}>
                  <div className="card-lift glow-card h-full rounded-2xl border border-[#E3E8E4] bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                        <feature.icon className="size-5" />
                      </span>
                      <span className="font-mono text-[10px] font-semibold text-[#C3D2C8]">
                        0{index + 1}
                      </span>
                    </div>
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
              Tiga langkah, server siap.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#5B6B60]">
              Alur yang singkat dan transparan. Kamu selalu tahu di mana posisi pesananmu.
            </p>
          </Reveal>

          <div className="relative mt-12 grid gap-5 md:grid-cols-3">
            <div
              className="pointer-events-none absolute top-10 right-[16.67%] left-[16.67%] hidden h-px bg-gradient-to-r from-transparent via-[#B9D7C4] to-transparent md:block"
              aria-hidden
            />
            {steps.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.07}>
                <div className="relative h-full rounded-2xl border border-[#E3E8E4] bg-white p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-[#0B3D2E] text-white shadow-[0_14px_30px_-18px_rgba(11,61,46,0.8)]">
                      <step.icon className="size-5" />
                    </span>
                    <span className="font-mono text-xs font-bold tracking-[0.18em] text-[#B9D7C4]">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="mt-5 text-[10px] font-bold tracking-[0.16em] text-[#8A9A90] uppercase">
                    {step.tag}
                  </p>
                  <h3 className="mt-1.5 text-lg font-bold text-[#101613]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-y border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container section-pad">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge className="border border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-white">
              Untuk siapa
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">
              Satu platform, banyak cara pakai.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#5B6B60]">
              Dari eksperimen pertama sampai operasional bisnis, resource bisa menyesuaikan kebutuhan.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {useCases.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.06}>
                <div className="card-lift glow-card h-full rounded-2xl border border-[#E3E8E4] bg-white p-6">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-[#E7F4EC] text-[#0B3D2E]">
                    <item.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-[#101613]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">{item.body}</p>
                  <ul className="mt-5 flex flex-col gap-2.5 border-t border-[#EDF1EE] pt-4">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-center gap-2 text-sm text-[#101613]">
                        <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[#E7F4EC] text-[#0B3D2E]">
                          <Check className="size-3" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Control panel preview */}
      <section className="relative overflow-hidden bg-[#06231A] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(circle at 82% 18%, rgba(22,163,74,0.2), transparent 38%), radial-gradient(circle at 12% 90%, rgba(74,222,128,0.1), transparent 36%)",
          }}
          aria-hidden
        />
        <div className="ws-container relative grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <Reveal>
            <Badge className="border border-white/15 bg-white/5 text-white/75 hover:bg-white/5">
              Panel kontrol
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Semua server, satu dashboard.
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/65">
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
                <li key={item} className="flex items-start gap-2.5 text-sm text-white/80">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#16A34A]/15 text-[#86EFAC]">
                    <Check className="size-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="shimmer-btn bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
                <Link href="/fitur">
                  Jelajahi fitur <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/status">
                  <span className="size-1.5 rounded-full bg-[#4ADE80]" /> Status layanan
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[#16A34A]/10 blur-3xl"
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-[1.5rem] border border-white/15 bg-white text-[#101613] shadow-[0_32px_90px_-38px_rgba(0,0,0,0.85)]">
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

              <div className="absolute -right-3 -bottom-4 hidden items-center gap-2 rounded-xl border border-[#D8E2DB] bg-white px-3.5 py-2.5 text-xs text-[#101613] shadow-xl sm:flex">
                <span className="flex size-6 items-center justify-center rounded-full bg-[#E7F4EC] text-[#0B3D2E]">
                  <Check className="size-3.5" />
                </span>
                <span>
                  <span className="block font-semibold">Snapshot tersimpan</span>
                  <span className="block text-[10px] text-[#8A9A90]">siap restore kapan saja</span>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-pad">
        <div className="ws-container grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <Reveal>
            <Badge className="border border-[#CFE6D8] bg-[#E7F4EC] text-[#0B3D2E] hover:bg-[#E7F4EC]">FAQ</Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">
              Pertanyaan yang sering diajukan.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#5B6B60]">
              Tidak menemukan jawaban? Hubungi support melalui WhatsApp atau buka tiket di dashboard.
            </p>
            <div className="mt-6 rounded-2xl border border-[#D8E2DB] bg-[#F7F8F7] p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-[#101613]">
                <Headphones className="size-4 text-[#0B3D2E]" /> Butuh jawaban cepat?
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">
                Tim support siap membantu memilih paket atau menyelesaikan kendala teknis.
              </p>
              <Button asChild variant="outline" className="mt-4 border-[#D8E2DB] bg-white text-[#0B3D2E]">
                <Link href="/kontak">
                  Hubungi support <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="rounded-2xl border border-[#E3E8E4] bg-white p-2 sm:p-4">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={faq.q} value={`faq-${index}`} className="border-[#E3E8E4]">
                    <AccordionTrigger className="text-left text-[15px] font-semibold text-[#101613] hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-[#5B6B60]">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#0B3D2E] text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 10% 20%, rgba(74,222,128,0.16), transparent 40%), radial-gradient(circle at 92% 90%, rgba(22,163,74,0.18), transparent 38%)",
          }}
          aria-hidden
        />
        <div className="ws-container relative flex flex-col items-start justify-between gap-8 py-14 md:flex-row md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <Sparkles className="size-3.5 text-[#86EFAC]" /> Mulai hari ini
            </p>
            <h2 className="mt-4 max-w-xl font-display text-2xl leading-tight font-bold tracking-tight text-white sm:text-3xl">
              Dari ide ke server dalam hitungan menit.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
              Daftar gratis, pilih paket, dan bayar dengan metode yang paling nyaman. Tanpa kontrak jangka
              panjang, tanpa biaya setup.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="shimmer-btn bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
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
              <Link href="/pricing">Lihat harga</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
