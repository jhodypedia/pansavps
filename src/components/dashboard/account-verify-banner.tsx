import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccountVerifyBanner() {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 sm:flex-row sm:items-center">
      <ShieldCheck className="size-5 shrink-0 text-[#92400E]" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#92400E]">Akun belum diverifikasi</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[#92400E]/80">
          Verifikasi via kode WhatsApp (prioritas) atau tautan email sebelum membeli VPS. Kode
          WhatsApp dikirim ke nomor yang terdaftar.
        </p>
      </div>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="border-[#FDE68A] bg-white text-[#92400E] hover:bg-[#FFFBEB]"
      >
        <Link href="/verifikasi-akun">
          Verifikasi <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
