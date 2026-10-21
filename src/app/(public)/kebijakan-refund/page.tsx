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
      intro={`Kami ingin setiap transaksi di ${brand.siteName} berjalan adil. Kebijakan ini menjelaskan kapan refund dapat diberikan dan bagaimana prosesnya.`}
      sections={[
        {
          heading: "Refund ke saldo",
          body: [
            "Jika provisioning gagal karena masalah pada sistem kami dan layanan tidak dapat diaktifkan, dana dapat dikembalikan sebagai saldo akun.",
            "Permintaan refund dapat diajukan dari halaman detail pesanan atau melalui tiket dengan departemen billing. Sertakan nomor pesanan dan alasan singkat.",
          ],
        },
        {
          heading: "Refund ke metode pembayaran asal",
          body: [
            "Refund ke metode pembayaran asal dapat dipertimbangkan untuk kasus tertentu, dengan memperhitungkan biaya transaksi yang tidak dapat ditarik kembali oleh penyedia pembayaran.",
            "Waktu pemrosesan refund mengikuti kebijakan penyedia pembayaran dan dapat memakan waktu hingga 14 hari kerja.",
          ],
        },
        {
          heading: "Kondisi yang tidak memenuhi syarat refund",
          body: [
            "Layanan yang sudah aktif dan digunakan, termasuk pemakaian sebagian periode, umumnya tidak dapat direfund penuh.",
            "Pelanggaran syarat dan ketentuan, penggunaan untuk aktivitas ilegal, atau penangguhan akibat pelanggaran tidak disertai refund.",
            "Ketidaksesuaian yang disebabkan oleh konfigurasi pengguna setelah akses root diberikan bukan merupakan alasan refund.",
          ],
        },
        {
          heading: "Pembatalan sebelum provisioning",
          body: [
            "Pesanan yang belum dibayar dapat dibatalkan tanpa biaya. Jika pembayaran sudah diterima tetapi server belum dibuat, refund ke saldo dapat diproses setelah verifikasi.",
          ],
        },
        {
          heading: "Cara mengajukan",
          body: [
            "Buka tiket dengan departemen billing atau hubungi support. Sertakan nomor invoice, nomor pesanan, dan penjelasan masalah.",
            "Tim kami akan meninjau permintaan dan memberikan keputusan melalui tiket atau email resmi.",
          ],
        },
      ]}
    />
  );
}
