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
      intro={`Dokumen ini menjelaskan target ketersediaan dan dukungan untuk layanan VPS ${brand.siteName}. SLA ini merupakan target operasional, bukan jaminan tanpa pengecualian.`}
      sections={[
        {
          heading: "Target ketersediaan",
          body: [
            "Target ketersediaan jaringan dan infrastruktur adalah 99,9% per bulan kalender, tidak termasuk pemeliharaan terjadwal dan gangguan di luar kendali kami.",
            "Ketersediaan diukur berdasarkan kemampuan server untuk dijangkau melalui jaringan. Gangguan akibat konfigurasi pengguna, aplikasi, atau serangan terhadap server tidak termasuk dalam perhitungan.",
          ],
        },
        {
          heading: "Pemeliharaan",
          body: [
            "Pemeliharaan terjadwal akan diupayakan dilakukan pada jam sepi dan diinformasikan sebelumnya melalui kanal resmi bila memungkinkan.",
            "Pemeliharaan darurat untuk alasan keamanan dapat dilakukan tanpa pemberitahuan awal.",
          ],
        },
        {
          heading: "Dukungan",
          body: [
            "Dukungan tersedia melalui tiket dashboard dan WhatsApp. Tiket dengan prioritas urgent ditangani lebih dahulu.",
            "Verifikasi pembayaran manual diproses maksimal 1x24 jam pada hari kerja. Provisioning otomatis berjalan tanpa menunggu jam kerja.",
          ],
        },
        {
          heading: "Kompensasi",
          body: [
            "Jika target ketersediaan tidak terpenuhi akibat kesalahan di sisi kami, kompensasi dapat diberikan dalam bentuk kredit saldo setelah peninjauan.",
            "Besaran kompensasi ditentukan berdasarkan durasi gangguan dan dampak terhadap layanan, dengan nilai maksimal sebesar biaya layanan bulan berjalan.",
          ],
        },
        {
          heading: "Pengecualian",
          body: [
            "Gangguan akibat force majeure, bencana alam, kebijakan penyedia infrastruktur, serangan DDoS berskala besar, atau tindakan pengguna tidak termasuk dalam SLA.",
            "Pengguna wajib menjaga backup mandiri dan konfigurasi keamanan server.",
          ],
        },
      ]}
    />
  );
}
