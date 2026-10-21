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
      intro={`Kebijakan ini menjelaskan bagaimana ${brand.siteName} mengumpulkan, menggunakan, dan melindungi data pribadi kamu saat menggunakan layanan.`}
      sections={[
        {
          heading: "Data yang kami kumpulkan",
          body: [
            "Data akun seperti nama, alamat email, nomor WhatsApp, dan kata sandi yang disimpan dalam bentuk hash.",
            "Data transaksi seperti pesanan, invoice, metode pembayaran, dan riwayat saldo. Kami tidak menyimpan nomor kartu atau kredensial perbankan lengkap.",
            "Data teknis seperti alamat IP, user agent, log audit, dan aktivitas server yang diperlukan untuk keamanan dan operasional.",
          ],
        },
        {
          heading: "Cara kami menggunakan data",
          body: [
            "Untuk menyediakan layanan, memproses pembayaran, melakukan provisioning server, mengirim notifikasi, dan memberikan dukungan.",
            "Untuk mencegah penyalahgunaan, mendeteksi aktivitas mencurigakan, dan memenuhi kewajiban hukum.",
            "Untuk meningkatkan kualitas layanan melalui analisis agregat yang tidak mengidentifikasi individu.",
          ],
        },
        {
          heading: "Berbagi data dengan pihak ketiga",
          body: [
            "Kami dapat membagikan data yang diperlukan kepada penyedia infrastruktur (DigitalOcean), penyedia pembayaran (Tripay), penyedia layanan email (SMTP), dan penyedia pesan (WhatsApp) semata-mata untuk menjalankan layanan.",
            "Kami tidak menjual data pribadi kepada pihak ketiga.",
          ],
        },
        {
          heading: "Penyimpanan dan keamanan",
          body: [
            "Kredensial sensitif seperti password root server dan kunci API disimpan terenkripsi menggunakan AES-256-GCM.",
            "Akses ke data dibatasi berdasarkan peran. Setiap akses admin terhadap kredensial dicatat dalam audit log.",
            "Kami menyimpan data selama akun aktif atau selama diperlukan untuk memenuhi kewajiban hukum dan penyelesaian sengketa.",
          ],
        },
        {
          heading: "Hak kamu",
          body: [
            "Kamu dapat memperbarui data profil, mengganti password, dan mengeluarkan sesi aktif dari halaman pengaturan.",
            "Untuk permintaan akses, koreksi, atau penghapusan data, hubungi support melalui kanal resmi. Kami akan menindaklanjuti sesuai ketentuan yang berlaku.",
          ],
        },
        {
          heading: "Cookie dan sesi",
          body: [
            "Kami menggunakan cookie sesi yang bersifat httpOnly untuk menjaga status login. Cookie ini tidak digunakan untuk iklan pihak ketiga.",
          ],
        },
        {
          heading: "Perubahan kebijakan",
          body: [
            "Kebijakan ini dapat diperbarui sewaktu-waktu. Perubahan material akan diinformasikan melalui kanal resmi atau halaman ini.",
          ],
        },
      ]}
    />
  );
}
