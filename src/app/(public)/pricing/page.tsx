import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Globe2, HelpCircle, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { osImages, plans, regions } from "@/lib/db/schema";
import { getPublicBrand } from "@/lib/settings";
import { formatIDR } from "@/lib/format";
import { cycleUnitPrice } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <>
      <section className="border-b border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container py-14 text-center md:py-20">
          <Badge className="border border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-white">
            Harga {brand.siteName}
          </Badge>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl md:text-5xl">
            Harga jelas, spesifikasi nyata
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[#5B6B60]">
            Mulai dari {formatIDR(cheapest)} per bulan. Pilih siklus pembayaran yang paling sesuai, tanpa
            biaya setup tersembunyi.
          </p>
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

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Tanpa biaya tersembunyi", body: "Harga yang tampil adalah yang kamu bayar. Pajak mengikuti ketentuan yang berlaku." },
              { icon: Globe2, title: "Region fleksibel", body: `Tersedia ${regionRows.map((r) => r.name).join(", ")}.` },
              { icon: Check, title: "Sistem operasi populer", body: `Pilihan image: ${osRows.map((o) => o.distribution).join(", ")}.` },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
                <item.icon className="size-5 text-[#0B3D2E]" />
                <h2 className="mt-3 text-sm font-bold text-[#101613]">{item.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#5B6B60]">{item.body}</p>
              </div>
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
