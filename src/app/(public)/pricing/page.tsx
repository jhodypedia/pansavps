import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Globe2, HelpCircle, ShieldCheck, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { osImages, plans, regions } from "@/lib/db/schema";
import { getPublicBrand } from "@/lib/settings";
import { formatIDR } from "@/lib/format";
import { cycleUnitPrice } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/shared/reveal";
import { PricingTable } from "@/components/public/pricing-table";

export const metadata: Metadata = {
  title: "Harga VPS",
  description: "Bandingkan paket VPS, spesifikasi, dan harga bulanan, kuartalan, serta tahunan dalam rupiah.",
};

export default async function PricingPage() {
  const brand = getPublicBrand();
  const items = db.select().from(plans).all().filter((p) => p.isActive);
  items.sort((a, b) => a.sortOrder - b.sortOrder);
  const regionRows = db.select().from(regions).all().filter((r) => r.isActive);
  const osRows = db.select().from(osImages).all().filter((o) => o.isActive);
  const cheapest = items.length ? Math.min(...items.map((p) => cycleUnitPrice(p, "monthly"))) : 0;
  const weeklyCheapest = items.length ? Math.min(...items.map((p) => cycleUnitPrice(p, "weekly"))) : 0;

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-[#06231A] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "linear-gradient(to bottom, black, transparent 88%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 88%)",
          }}
          aria-hidden
        />
        <div className="ws-container relative py-16 md:py-24">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Badge className="border border-white/15 bg-white/5 text-white/80 hover:bg-white/5">
              Harga {brand.siteName}
            </Badge>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Harga jelas, spesifikasi nyata.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              Mulai dari {formatIDR(cheapest)} per bulan
              {weeklyCheapest > 0 ? (
                <>
                  {" "}
                  atau {formatIDR(weeklyCheapest)} per minggu
                </>
              ) : null}
              . Pilih siklus yang paling sesuai, tanpa biaya setup tersembunyi.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
                <Link href="/fitur">Lihat fitur</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#86EFAC]" /> Tanpa biaya setup
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#86EFAC]" /> Harga rupiah
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#86EFAC]" /> Aktivasi otomatis
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#86EFAC]" /> Support WhatsApp
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-pad">
        <div className="ws-container">
          {items.length ? (
            <PricingTable items={items} />
          ) : (
            <div className="rounded-2xl border border-dashed border-[#D8E2DB] bg-[#FBFCFB] p-12 text-center">
              <p className="text-sm text-[#5B6B60]">Belum ada paket aktif. Silakan hubungi support.</p>
            </div>
          )}

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "Tanpa biaya tersembunyi",
                body: "Harga yang tampil adalah yang kamu bayar. Pajak mengikuti ketentuan yang berlaku.",
              },
              {
                icon: Globe2,
                title: "Region fleksibel",
                body: `Tersedia ${regionRows.map((r) => r.name).join(", ")}. Pilih region terdekat dengan penggunamu.`,
              },
              {
                icon: Zap,
                title: "Aktivasi otomatis",
                body: `Pilihan image: ${osRows.map((o) => o.distribution).join(", ")}. Server aktif otomatis setelah pembayaran terverifikasi.`,
              },
            ].map((item) => (
              <Reveal key={item.title}>
                <div className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
                  <item.icon className="size-5 text-[#0B3D2E]" />
                  <h2 className="mt-3 text-sm font-bold text-[#101613]">{item.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#5B6B60]">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-[#CFE6D8] bg-[#E7F4EC] p-6 md:flex md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0B3D2E]">Butuh spesifikasi khusus?</h2>
              <p className="mt-1 text-sm text-[#0B3D2E]/75">
                Hubungi tim kami untuk kebutuhan RAM, storage, atau region tambahan.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 md:mt-0">
              <Button asChild variant="outline" className="border-[#0B3D2E]/20 bg-white text-[#0B3D2E] hover:bg-white/80">
                <Link href="/faq">
                  <HelpCircle className="size-4" /> Baca FAQ
                </Link>
              </Button>
              <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                <Link href="/kontak">
                  Hubungi kami <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}