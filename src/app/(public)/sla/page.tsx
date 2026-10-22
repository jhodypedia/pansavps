import type { Metadata } from "next";
import { getPublicBrand } from "@/lib/settings";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "Service Level Agreement" };

export default function SlaPage() {
  const brand = getPublicBrand();
  return (
    <LegalPage
      title="Service Level Agreement (SLA)"
      updated="20 Oktober 2026"
      intro={`Di sini kami jelaskan seberapa stabil layanan VPS ${brand.siteName} yang kami targetkan dan bantuan seperti apa yang bisa kamu dapat. Ini target operasional, bukan janji tanpa pengecualian.`}
      sections={[
        {
          heading: "Target ketersediaan",
          body: [
            "Kami menargetkan jaringan dan infrastruktur tersedia 99,9% per bulan. Angka ini belum menghitung pemeliharaan terjadwal dan gangguan yang di luar kendali kami.",
            "Ketersediaan dihitung dari apakah server bisa dijangkau lewat jaringan. Gangguan karena konfigurasi pengguna, aplikasi, atau serangan ke server tidak masuk hitungan.",
          ],
        },
        {
          heading: "Pemeliharaan",
          body: [
            "Kalau memungkinkan, pemeliharaan terjadwal kami lakukan di jam sepi dan infokan lebih dulu lewat kanal resmi.",
            "Pemeliharaan darurat untuk alasan keamanan bisa dilakukan tanpa pemberitahuan awal.",
          ],
        },
        {
          heading: "Dukungan",
          body: [
            "Bantuan tersedia lewat tiket dashboard dan WhatsApp. Tiket urgent kami tangani lebih dulu.",
            "Verifikasi transfer bank maksimal 1x24 jam di hari kerja. Pembuatan server otomatis tetap jalan tanpa nunggu jam kerja.",
          ],
        },
        {
          heading: "Kompensasi",
          body: [
            "Kalau target ketersediaan meleset karena kesalahan di sisi kami, kami bisa memberi kompensasi berupa kredit saldo setelah ditinjau.",
            "Besarnya kompensasi melihat durasi gangguan dan dampaknya ke layanan, maksimal sebesar biaya layanan bulan berjalan.",
          ],
        },
        {
          heading: "Pengecualian",
          body: [
            "Gangguan karena force majeure, bencana alam, kebijakan penyedia infrastruktur, serangan DDoS besar, atau tindakan pengguna tidak termasuk SLA.",
            "Kamu tetap perlu menyiapkan backup sendiri dan menjaga konfigurasi keamanan server.",
          ],
        },
      ]}
    />
  );
}
