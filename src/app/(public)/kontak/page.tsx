import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Mail, MessageCircle, Ticket } from "lucide-react";
import { getPublicBrand } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Kontak",
  description: "Hubungi tim support melalui email, WhatsApp, atau tiket dashboard.",
};

export default async function ContactPage() {
  const brand = getPublicBrand();
  const user = await getSessionUser();
  const wa = brand.supportWhatsapp.replace(/\D/g, "");

  return (
    <>
      <section className="border-b border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container py-14 md:py-20">
          <Badge className="border border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-white">Kontak</Badge>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl md:text-5xl">
            Ada yang bisa kami bantu?
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5B6B60]">
            Pilih kanal yang paling nyaman. Untuk masalah akun atau server, tiket dashboard membantu kami
            melacak riwayat dengan lebih cepat.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="ws-container grid gap-6 md:grid-cols-3">
          <div className="flex h-full flex-col rounded-2xl border border-[#E3E8E4] bg-white p-6">
            <span className="flex size-12 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
              <MessageCircle className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[#101613]">WhatsApp</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#5B6B60]">
              Respons cepat untuk pertanyaan umum dan status layanan.
            </p>
            {wa ? (
              <Button asChild className="mt-5 bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                  Chat WhatsApp <ArrowRight className="size-4" />
                </a>
              </Button>
            ) : (
              <p className="mt-5 text-sm text-[#8A9A90]">Nomor belum diatur.</p>
            )}
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-[#E3E8E4] bg-white p-6">
            <span className="flex size-12 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
              <Mail className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[#101613]">Email</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#5B6B60]">
              Untuk pertanyaan detail, dokumen, atau kerja sama.
            </p>
            <Button asChild variant="outline" className="mt-5 border-[#D8E2DB] bg-white text-[#0B3D2E]">
              <a href={`mailto:${brand.supportEmail}`}>
                Kirim email <ArrowRight className="size-4" />
              </a>
            </Button>
            <p className="mt-3 text-xs text-[#8A9A90]">{brand.supportEmail}</p>
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-[#0B3D2E] bg-[#0B3D2E] p-6 text-white">
            <span className="flex size-12 items-center justify-center rounded-xl bg-white/10 text-white">
              <Ticket className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold">Tiket dashboard</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-white/70">
              Terhubung langsung dengan layanan dan invoice kamu. Riwayat percakapan tersimpan.
            </p>
            <Button asChild className="mt-5 bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
              <Link href={user ? "/dashboard/tiket/baru" : "/login?next=/dashboard/tiket/baru"}>
                {user ? "Buka tiket" : "Masuk untuk buka tiket"} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="ws-container mt-10">
          <div className="flex flex-col gap-4 rounded-2xl border border-[#E3E8E4] bg-[#FBFCFB] p-6 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0B3D2E] ring-1 ring-[#E3E8E4]">
              <Clock className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#101613]">Waktu respons</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#5B6B60]">
                Tiket prioritas urgent ditangani lebih dulu. Verifikasi transfer bank maksimal 1x24 jam pada
                hari kerja. Notifikasi otomatis tetap berjalan di luar jam kerja.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
