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
  description: "Jawaban singkat soal VPS, pembayaran, aktivasi server, perpanjangan, dan refund.",
};

const groups = [
  {
    title: "Pemesanan & pembayaran",
    items: [
      {
        q: "Bagaimana cara pesan VPS?",
        a: "Pilih paket di halaman harga, tentukan siklus pembayaran, region, OS, dan hostname. Setelah checkout, invoice langsung dibuat. Bayar pakai saldo atau pembayaran otomatis? Server langsung diproses. Kalau transfer bank, admin cek dulu buktinya.",
      },
      {
        q: "Metode pembayaran apa yang bisa dipakai?",
        a: "Saldo akun, Transfer BANK, dan pembayaran otomatis lewat Tripay (QRIS, VA, e-wallet, atau gerai retail). Klik pembayaran otomatis, lalu pilih channel yang tersedia.",
      },
      {
        q: "Harga yang tampil sudah termasuk pajak?",
        a: "Harga yang kamu lihat adalah harga layanan. Kalau penyedia pembayaran menambah biaya atau pajak, jumlahnya akan terlihat sebelum kamu bayar.",
      },
      {
        q: "Bisa batalkan pesanan?",
        a: "Bisa, selama belum dibayar. Buka detail pesanan lalu batalkan dari sana. Kalau sudah dibayar dan server mulai dibuat, ikuti kebijakan refund yang berlaku.",
      },
      {
        q: "Bagaimana cara top up saldo?",
        a: "Buka menu Saldo, isi nominal, lalu pilih metode pembayaran. Setelah pembayaran masuk, saldo langsung bisa dipakai untuk pesanan baru atau perpanjangan.",
      },
    ],
  },
  {
    title: "Server & aktivasi",
    items: [
      {
        q: "Berapa lama server aktif setelah bayar?",
        a: "Kalau bayar pakai saldo atau pembayaran otomatis, server langsung dibuat. Biasanya aktif dalam hitungan detik sampai beberapa menit, tergantung region dan OS. Transfer BANK dicek maksimal 1x24 jam di hari kerja.",
      },
      {
        q: "Bisa akses root?",
        a: "Semua VPS bisa akses root penuh. Kamu bisa pakai password yang dibuat sistem atau SSH key milikmu sendiri.",
      },
      {
        q: "Sistem operasi apa saja yang tersedia?",
        a: "Ubuntu 24.04, Ubuntu 22.04, Debian 12, AlmaLinux 9, dan Rocky Linux 9. Daftar image yang aktif bisa dilihat saat checkout.",
      },
      {
        q: "Kalau server gagal dibuat, gimana?",
        a: "Buka detail pesanan. Kalau tombol coba buat server lagi muncul, klik tombol itu. Masih gagal? Buka tiket atau minta refund ke saldo.",
      },
      {
        q: "Bisa upgrade paket?",
        a: "Bisa, dari halaman detail VPS selama server masih aktif. Biayanya dihitung dari sisa masa aktif, lalu server dipindah ke paket baru.",
      },
    ],
  },
  {
    title: "Perpanjangan & penghentian",
    items: [
      {
        q: "Bagaimana perpanjangan otomatis bekerja?",
        a: "Kalau perpanjangan otomatis aktif dan saldo cukup, invoice perpanjangan dibuat dan dibayar otomatis saat masa aktif habis. Jadi pastikan saldo selalu ada.",
      },
      {
        q: "Kalau saldo tidak cukup?",
        a: "Layanan ditangguhkan setelah masa aktif berakhir. Data masih disimpan selama masa tenggang, dan kamu bisa perpanjang dari halaman VPS untuk mengaktifkannya lagi.",
      },
      {
        q: "Kapan VPS dihapus permanen?",
        a: "Setelah masa tenggang lewat, server dihapus otomatis. Data yang sudah terhapus tidak bisa dipulihkan.",
      },
      {
        q: "Ada pengingat sebelum jatuh tempo?",
        a: "Ada. Pengingat dikirim lewat email dan WhatsApp beberapa hari sebelum masa aktif habis.",
      },
    ],
  },
  {
    title: "Keamanan & akun",
    items: [
      {
        q: "Bagaimana data akses disimpan?",
        a: "Password root dan kunci pembayaran disimpan terenkripsi AES-256-GCM. Setiap akses ke data sensitif, termasuk oleh admin, dicatat di log.",
      },
      {
        q: "Bisa pakai SSH key?",
        a: "Bisa. Tambahkan public key di menu SSH Keys, lalu pilih saat checkout atau pasang ulang OS. Public key bukan rahasia, tapi tetap kami simpan per akun.",
      },
      {
        q: "Bagaimana cara mengamankan akun?",
        a: "Pakai password yang kuat dan unik, jangan bagikan data akses server, dan keluarkan sesi yang tidak dikenal dari halaman Pengaturan. Verifikasi email juga sebaiknya dilakukan.",
      },
      {
        q: "Data saya dibagikan?",
        a: "Kami hanya memakai data yang dibutuhkan untuk menjalankan layanan. Rinciannya ada di Kebijakan Privasi.",
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
