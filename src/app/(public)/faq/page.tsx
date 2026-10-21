import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Jawaban atas pertanyaan umum tentang VPS, pembayaran, provisioning, perpanjangan, dan refund.",
};

const groups = [
  {
    title: "Pemesanan & pembayaran",
    items: [
      {
        q: "Bagaimana alur pemesanan VPS?",
        a: "Pilih paket di halaman harga, tentukan siklus pembayaran, region, sistem operasi, dan hostname. Setelah checkout, kamu akan mendapat invoice. Pembayaran melalui saldo diproses instan, sedangkan transfer manual menunggu verifikasi admin.",
      },
      {
        q: "Metode pembayaran apa yang tersedia?",
        a: "Transfer bank manual dan Tripay. Metode yang tampil di checkout mengikuti pengaturan admin. Jika gateway belum diaktifkan, kamu tetap bisa menggunakan transfer manual atau saldo.",
      },
      {
        q: "Apakah harga sudah termasuk pajak?",
        a: "Harga yang ditampilkan adalah harga layanan. Pajak atau biaya tambahan dari penyedia pembayaran, bila ada, akan mengikuti ketentuan masing-masing penyedia.",
      },
      {
        q: "Bisakah saya membatalkan pesanan?",
        a: "Pesanan yang belum dibayar dapat dibatalkan dari halaman detail pesanan. Setelah dibayar dan provisioning dimulai, pembatalan mengikuti kebijakan refund.",
      },
      {
        q: "Bagaimana cara top up saldo?",
        a: "Buka menu Saldo di dashboard, masukkan nominal, lalu pilih metode pembayaran. Setelah pembayaran terverifikasi, saldo otomatis bertambah dan dapat dipakai untuk pemesanan maupun perpanjangan.",
      },
    ],
  },
  {
    title: "Server & provisioning",
    items: [
      {
        q: "Berapa lama server aktif setelah pembayaran?",
        a: "Pembayaran saldo dan gateway yang terkonfirmasi otomatis memicu provisioning segera. Umumnya server aktif dalam hitungan detik hingga beberapa menit. Transfer manual menunggu verifikasi admin maksimal 1x24 jam pada hari kerja.",
      },
      {
        q: "Apakah saya mendapat akses root?",
        a: "Ya, setiap VPS memberikan akses root penuh. Kamu dapat memilih login dengan password yang dihasilkan sistem atau memakai SSH key sendiri.",
      },
      {
        q: "Sistem operasi apa saja yang didukung?",
        a: "Ubuntu 24.04, Ubuntu 22.04, Debian 12, AlmaLinux 9, dan Rocky Linux 9. Daftar image aktif dapat dilihat saat checkout.",
      },
      {
        q: "Apa yang harus dilakukan jika provisioning gagal?",
        a: "Buka detail pesanan. Jika tombol coba ulang tersedia, kamu dapat menjadwalkan provisioning ulang. Jika masih gagal, buka tiket atau minta refund ke saldo.",
      },
      {
        q: "Apakah bisa upgrade paket?",
        a: "Bisa. Upgrade tersedia dari halaman detail VPS selama server aktif. Biaya dihitung prorata berdasarkan sisa masa aktif, lalu droplet di-resize ke paket baru.",
      },
    ],
  },
  {
    title: "Perpanjangan & penghentian",
    items: [
      {
        q: "Bagaimana perpanjangan otomatis bekerja?",
        a: "Jika auto-renew aktif dan saldo mencukupi, sistem membuat invoice perpanjangan dan membayarnya otomatis saat masa aktif berakhir. Pastikan saldo selalu cukup.",
      },
      {
        q: "Apa yang terjadi jika saldo tidak cukup?",
        a: "Layanan ditangguhkan setelah masa aktif berakhir. Data masih tersimpan selama masa tenggang. Kamu bisa memperpanjang dari halaman VPS untuk mengaktifkan kembali layanan.",
      },
      {
        q: "Kapan VPS dihapus permanen?",
        a: "Setelah melewati masa tenggang, droplet dihapus otomatis dan status layanan menjadi terminated. Data tidak dapat dipulihkan setelah penghapusan.",
      },
      {
        q: "Apakah ada pengingat sebelum jatuh tempo?",
        a: "Ya. Pengingat dikirim melalui email dan WhatsApp sesuai pengaturan admin, biasanya beberapa hari sebelum jatuh tempo.",
      },
    ],
  },
  {
    title: "Keamanan & akun",
    items: [
      {
        q: "Bagaimana kredensial disimpan?",
        a: "Password root dan secret gateway disimpan terenkripsi AES-256-GCM. Akses ke kredensial dicatat dalam audit log, termasuk akses oleh admin.",
      },
      {
        q: "Apakah bisa memakai SSH key?",
        a: "Bisa. Tambahkan public key di menu SSH Keys, lalu pilih saat checkout atau saat rebuild. Public key tidak bersifat rahasia, tetapi tetap kami simpan per akun.",
      },
      {
        q: "Bagaimana mengamankan akun?",
        a: "Gunakan password kuat dan unik, jangan bagikan kredensial server, dan keluarkan sesi yang tidak dikenal dari halaman Pengaturan. Verifikasi email juga disarankan.",
      },
      {
        q: "Apakah data saya dibagikan?",
        a: "Kami hanya menggunakan data yang diperlukan untuk operasional layanan. Lihat Kebijakan Privasi untuk rincian.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <section className="border-b border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container py-14 text-center md:py-20">
          <Badge className="border border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-white">Pusat bantuan</Badge>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl md:text-5xl">
            Pertanyaan yang sering diajukan
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[#5B6B60]">
            Cari jawaban cepat tentang pemesanan, server, pembayaran, dan keamanan.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="ws-container grid gap-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <div className="sticky top-24 rounded-2xl border border-[#E3E8E4] bg-white p-5">
              <h2 className="text-sm font-bold text-[#101613]">Butuh bantuan langsung?</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#5B6B60]">
                Tim support siap membantu melalui tiket dashboard atau WhatsApp.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                  <Link href="/kontak">
                    <MessageCircle className="size-4" /> Hubungi support
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-[#D8E2DB] bg-white text-[#0B3D2E]">
                  <Link href="/dashboard/tiket/baru">
                    Buka tiket <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-10">
            {groups.map((group) => (
              <div key={group.title}>
                <h2 className="font-display text-xl font-bold text-[#101613]">{group.title}</h2>
                <Accordion type="single" collapsible className="mt-3">
                  {group.items.map((item, index) => (
                    <AccordionItem key={item.q} value={`${group.title}-${index}`} className="border-[#E3E8E4]">
                      <AccordionTrigger className="text-left text-[15px] font-semibold text-[#101613] hover:no-underline">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm leading-relaxed text-[#5B6B60]">{item.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
