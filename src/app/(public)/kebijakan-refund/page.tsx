import type { Metadata } from "next";
import { getPublicBrand } from "@/lib/settings";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "Kebijakan Refund" };

export default function RefundPage() {
  const brand = getPublicBrand();
  return (
    <LegalPage
      title="Kebijakan Refund"
      updated="20 Oktober 2026"
      intro={`Kami mau semua transaksi di ${brand.siteName} tetap adil. Di sini kami jelaskan kapan dana bisa dikembalikan dan bagaimana caranya.`}
      sections={[
        {
          heading: "Refund ke saldo",
          body: [
            "Kalau server gagal dibuat karena masalah di sistem kami dan layanan tidak bisa dipakai, dana bisa dikembalikan ke saldo akun.",
            "Ajukan refund dari halaman detail pesanan atau lewat tiket departemen billing. Sertakan nomor pesanan dan alasan singkatnya.",
          ],
        },
        {
          heading: "Refund ke metode pembayaran asal",
          body: [
            "Untuk kasus tertentu, refund ke metode pembayaran asal bisa dipertimbangkan. Nominalnya akan memperhitungkan biaya transaksi yang tidak bisa ditarik lagi oleh penyedia pembayaran.",
            "Waktu prosesnya mengikuti kebijakan penyedia pembayaran, bisa sampai 14 hari kerja.",
          ],
        },
        {
          heading: "Kondisi yang tidak memenuhi syarat refund",
          body: [
            "Layanan yang sudah aktif dan dipakai, termasuk pemakaian sebagian periode, umumnya tidak bisa direfund penuh.",
            "Pelanggaran syarat dan ketentuan, aktivitas ilegal, atau penangguhan karena pelanggaran tidak disertai refund.",
            "Masalah yang muncul dari konfigurasi pengguna setelah akses root diberikan bukan alasan refund.",
          ],
        },
        {
          heading: "Pembatalan sebelum server dibuat",
          body: [
            "Pesanan yang belum dibayar bisa dibatalkan tanpa biaya. Kalau pembayaran sudah masuk tapi server belum dibuat, refund ke saldo bisa diproses setelah dicek.",
          ],
        },
        {
          heading: "Cara mengajukan",
          body: [
            "Buka tiket departemen billing atau hubungi support. Sertakan nomor invoice, nomor pesanan, dan penjelasan masalahnya.",
            "Tim kami bakal cek permintaanmu dan kasih keputusan lewat tiket atau email resmi.",
          ],
        },
      ]}
    />
  );
}
