import Link from "next/link";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { NewTicketForm } from "@/components/dashboard/ticket-forms";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Buka Tiket" };

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ layanan?: string; invoice?: string; topik?: string }>;
}) {
  await requireUser();
  const { layanan, invoice, topik } = await searchParams;
  const subject = topik === "terminasi"
    ? "Permintaan terminasi VPS"
    : layanan
      ? `Bantuan untuk layanan ${layanan.slice(0, 12)}`
      : invoice
        ? `Bantuan invoice ${invoice}`
        : "";

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tiket", href: "/dashboard/tiket" },
          { label: "Buka tiket" },
        ]}
        title="Buka tiket baru"
        description="Jelaskan kendala sedetail mungkin. Tim support biasanya membalas dalam 1–3 jam kerja."
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/dashboard/tiket">
              <ArrowLeft className="size-4" /> Kembali
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <SectionCard title="Detail tiket">
          <NewTicketForm defaultSubject={subject} />
        </SectionCard>
        <div className="space-y-6">
          <SectionCard title="Sebelum mengirim">
            <ul className="space-y-3 text-sm text-[#5B6B60]">
              <li className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0B3D2E]" />
                Sertakan hostname VPS atau nomor invoice terkait.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0B3D2E]" />
                Jelaskan langkah yang sudah dicoba dan pesan error bila ada.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0B3D2E]" />
                Untuk masalah mendesak, gunakan prioritas tinggi atau mendesak.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0B3D2E]" />
                Jangan pernah mengirim password atau kode OTP melalui tiket.
              </li>
            </ul>
          </SectionCard>
          <div className="rounded-2xl border border-[#BFE3CC] bg-[#F3F9F5] p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-[#0B3D2E]">
              <LifeBuoy className="size-4" /> Butuh jawaban cepat?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#5B6B60]">
              Lihat FAQ dan status layanan untuk pertanyaan umum sebelum membuka tiket.
            </p>
            <div className="mt-3 flex gap-2">
              <Button asChild variant="outline" size="sm" className="border-[#BFE3CC] bg-white">
                <Link href="/faq">Baca FAQ</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-[#BFE3CC] bg-white">
                <Link href="/status">Status layanan</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
