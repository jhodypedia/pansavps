import type { Metadata } from "next";
import { getPublicBrand } from "@/lib/settings";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  const brand = getPublicBrand();
  return (
    <LegalPage
      title="Kebijakan Privasi"
      updated="20 Oktober 2026"
      intro={`Di sini kami jelaskan data apa yang ${brand.siteName} kumpulkan, bagaimana kami memakainya, dan cara kami menjaganya saat kamu memakai layanan.`}
      sections={[
        {
          heading: "Data yang kami kumpulkan",
          body: [
            "Data akun seperti nama, email, nomor WhatsApp, dan password yang disimpan dalam bentuk hash.",
            "Data transaksi seperti pesanan, invoice, metode pembayaran, dan riwayat saldo. Kami tidak menyimpan nomor kartu atau data perbankan lengkap.",
            "Data teknis seperti IP, user agent, log aktivitas, dan aktivitas server yang dibutuhkan untuk keamanan dan operasional.",
          ],
        },
        {
          heading: "Cara kami memakai data",
          body: [
            "Untuk menjalankan layanan, memproses pembayaran, menyiapkan server, mengirim notifikasi, dan memberi dukungan.",
            "Untuk mencegah penyalahgunaan, mendeteksi aktivitas mencurigakan, dan memenuhi kewajiban hukum.",
            "Untuk memperbaiki kualitas layanan lewat analisis gabungan yang tidak menunjuk ke satu orang.",
          ],
        },
        {
          heading: "Berbagi data dengan pihak ketiga",
          body: [
            "Kami bisa membagikan data yang perlu saja ke penyedia infrastruktur cloud, penyedia pembayaran (Tripay), penyedia email, dan penyedia pesan WhatsApp. Tujuannya cuma untuk menjalankan layanan.",
            "Kami tidak menjual data pribadi ke pihak ketiga.",
          ],
        },
        {
          heading: "Penyimpanan dan keamanan",
          body: [
            "Data sensitif seperti password root server dan kunci API disimpan terenkripsi dengan AES-256-GCM.",
            "Akses ke data dibatasi sesuai peran. Setiap akses admin ke data sensitif dicatat di log.",
            "Kami menyimpan data selama akun aktif atau selama masih dibutuhkan untuk kewajiban hukum dan penyelesaian sengketa.",
          ],
        },
        {
          heading: "Hak kamu",
          body: [
            "Kamu bisa memperbarui profil, mengganti password, dan mengeluarkan sesi aktif dari halaman Pengaturan.",
            "Kalau mau minta akses, koreksi, atau penghapusan data, hubungi support lewat kanal resmi. Kami akan tindak lanjuti sesuai aturan yang berlaku.",
          ],
        },
        {
          heading: "Cookie dan sesi",
          body: [
            "Kami memakai cookie sesi httpOnly untuk menjaga status login. Cookie ini tidak dipakai untuk iklan pihak ketiga.",
          ],
        },
        {
          heading: "Perubahan kebijakan",
          body: [
            "Kebijakan ini bisa diperbarui kapan saja. Perubahan penting akan kami infokan lewat kanal resmi atau halaman ini.",
          ],
        },
      ]}
    />
  );
}
