import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VerificationRequired({
  title = "Verifikasi akun diperlukan",
  description = "Verifikasi lewat kode WhatsApp (prioritas) atau tautan email sebelum membeli.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#92400E]">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#92400E]">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[#92400E]/80">{description}</p>
          <Button asChild size="sm" className="mt-4 bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Link href="/verifikasi-akun">
              Verifikasi sekarang <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
