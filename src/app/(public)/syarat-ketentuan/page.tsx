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
      intro={`Dokumen ini mengatur penggunaan layanan VPS yang disediakan oleh ${brand.siteName}. Dengan mendaftar dan memesan layanan, kamu dianggap telah membaca dan menyetujui ketentuan berikut.`}
      sections={[
        {
          heading: "Definisi layanan",
          body: [
            `${brand.siteName} menyediakan layanan virtual private server berbasis infrastruktur cloud, termasuk provisioning, panel kontrol, pemantauan status, dan dukungan pelanggan.`,
            "Layanan diberikan dalam bentuk langganan dengan periode tertentu sesuai siklus pembayaran yang dipilih. Spesifikasi mengikuti paket yang tercantum pada halaman harga saat pemesanan.",
          ],
        },
        {
          heading: "Akun dan keamanan",
          body: [
            "Kamu bertanggung jawab menjaga kerahasiaan kredensial akun dan server. Semua aktivitas yang dilakukan melalui akunmu dianggap sebagai aktivitasmu.",
            "Kami menyarankan penggunaan password yang kuat, verifikasi email, dan SSH key. Segera hubungi support jika mencurigai akses tidak sah.",
          ],
        },
        {
          heading: "Pembayaran dan perpanjangan",
          body: [
            "Invoice diterbitkan saat pemesanan atau perpanjangan. Pembayaran harus diselesaikan sebelum batas waktu yang tertera pada invoice.",
            "Pembayaran melalui gateway diproses oleh penyedia pihak ketiga dan tunduk pada ketentuan penyedia tersebut. Transfer manual diverifikasi oleh admin.",
            "Perpanjangan otomatis dapat diaktifkan. Jika saldo tidak mencukupi, layanan dapat ditangguhkan setelah masa aktif berakhir dan dihapus setelah masa tenggang.",
          ],
        },
        {
          heading: "Penggunaan yang dilarang",
          body: [
            "Layanan tidak boleh digunakan untuk aktivitas ilegal, penyebaran malware, spam, serangan terhadap sistem lain, pelanggaran hak cipta, atau konten yang melanggar hukum Indonesia.",
            "Kami berhak menangguhkan atau menghentikan layanan yang melanggar ketentuan, tanpa kewajiban pengembalian dana dalam kasus pelanggaran berat.",
          ],
        },
        {
          heading: "Ketersediaan layanan",
          body: [
            "Kami berupaya menjaga ketersediaan layanan, namun tidak menjamin layanan bebas gangguan sepenuhnya. Pemeliharaan terjadwal akan diinformasikan melalui kanal resmi bila memungkinkan.",
            "Tanggung jawab atas pencadangan data sepenuhnya berada pada pengguna. Kami menyediakan fitur snapshot sebagai alat bantu, bukan pengganti kebijakan backup mandiri.",
          ],
        },
        {
          heading: "Pembatasan tanggung jawab",
          body: [
            "Sejauh diizinkan hukum, tanggung jawab kami atas kerugian tidak langsung, kehilangan keuntungan, atau kehilangan data dibatasi pada nilai layanan yang dibayarkan untuk periode berjalan.",
          ],
        },
        {
          heading: "Perubahan ketentuan",
          body: [
            "Kami dapat memperbarui syarat dan ketentuan ini dari waktu ke waktu. Versi terbaru akan dipublikasikan pada halaman ini dan berlaku sejak tanggal pembaruan.",
          ],
        },
      ]}
    />
  );
}
