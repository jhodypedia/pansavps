import type { Metadata } from "next";
import { getPublicBrand } from "@/lib/settings";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "Syarat & Ketentuan" };

export default function TermsPage() {
  const brand = getPublicBrand();
  return (
    <LegalPage
      title="Syarat & Ketentuan"
      updated="20 Oktober 2026"
      intro={`Halaman ini mengatur cara pakai layanan VPS dari ${brand.siteName}. Dengan mendaftar dan memesan, kamu dianggap sudah membaca dan setuju dengan ketentuan di bawah.`}
      sections={[
        {
          heading: "Layanan yang kami sediakan",
          body: [
            `${brand.siteName} menyediakan VPS berbasis cloud, termasuk pembuatan server, panel kontrol, pemantauan status, dan dukungan pelanggan.`,
            "Layanan diberikan sebagai langganan sesuai siklus pembayaran yang kamu pilih. Spesifikasinya mengikuti paket yang tertera di halaman harga saat kamu memesan.",
          ],
        },
        {
          heading: "Akun dan keamanan",
          body: [
            "Kamu bertanggung jawab menjaga data akses akun dan server. Semua aktivitas yang terjadi lewat akunmu dianggap sebagai aktivitasmu.",
            "Pakai password yang kuat, verifikasi email, dan SSH key kalau bisa. Kalau ada akses yang mencurigakan, langsung hubungi support.",
          ],
        },
        {
          heading: "Pembayaran dan perpanjangan",
          body: [
            "Invoice dibuat saat kamu memesan atau memperpanjang layanan. Selesaikan pembayaran sebelum batas waktu yang tertera.",
            "Pembayaran online diproses oleh penyedia pihak ketiga dan mengikuti ketentuan mereka. Transfer BANK dicek oleh admin.",
            "Perpanjangan otomatis bisa diaktifkan. Kalau saldo tidak cukup, layanan bisa ditangguhkan setelah masa aktif habis dan dihapus setelah masa tenggang.",
          ],
        },
        {
          heading: "Yang tidak boleh dilakukan",
          body: [
            "Layanan tidak boleh dipakai untuk aktivitas ilegal, menyebarkan malware, spam, menyerang sistem lain, melanggar hak cipta, atau konten yang melanggar hukum Indonesia.",
            "Kami berhak menangguhkan atau menghentikan layanan yang melanggar aturan, tanpa kewajiban refund untuk pelanggaran berat.",
          ],
        },
        {
          heading: "Ketersediaan layanan",
          body: [
            "Kami berusaha menjaga layanan tetap jalan, tapi tidak bisa menjamin bebas gangguan sepenuhnya. Pemeliharaan terjadwal akan kami infokan lewat kanal resmi kalau memungkinkan.",
            "Backup data tetap tanggung jawabmu. Fitur snapshot kami sediakan sebagai bantuan, bukan pengganti backup mandiri.",
          ],
        },
        {
          heading: "Batasan tanggung jawab",
          body: [
            "Sejauh diizinkan hukum, tanggung jawab kami atas kerugian tidak langsung, kehilangan keuntungan, atau kehilangan data dibatasi pada nilai layanan yang kamu bayar untuk periode berjalan.",
          ],
        },
        {
          heading: "Perubahan ketentuan",
          body: [
            "Ketentuan ini bisa kami perbarui dari waktu ke waktu. Versi terbaru akan ada di halaman ini dan berlaku sejak tanggal pembaruan.",
          ],
        },
      ]}
    />
  );
}
