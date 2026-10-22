import Link from "next/link";
import { ArrowLeft, Check, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { getPublicBrand } from "@/lib/settings";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = getPublicBrand();
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.02fr_1fr]">
      <aside className="relative hidden flex-col justify-between bg-[#0B3D2E] p-10 text-white lg:flex xl:p-14">
        <Logo name={brand.siteName} logoUrl={brand.logoUrl} inverted />
        <div className="max-w-md">
          <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-white xl:text-4xl">
            VPS siap dipakai, tanpa ribet.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            Kelola VPS, invoice, dan akses server dari satu dashboard. Begitu pembayaran masuk, server
            langsung dibuat, dan kabar terbaru dikirim lewat WhatsApp.
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {[
              { icon: RefreshCw, text: "Server aktif otomatis setelah pembayaran" },
              { icon: ShieldCheck, text: "Password dan akses server tersimpan aman" },
              { icon: Lock, text: "Akses root dan SSH key sepenuhnya milikmu" },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Check className="size-3.5 text-[#86EFAC]" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-white/55">
          <p>
            Butuh bantuan? {brand.supportEmail ? `Email ${brand.supportEmail}` : "Hubungi support"} atau
            WhatsApp tim kami.
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between border-b border-[#E3E8E4] px-5 py-4 lg:px-10">
          <div className="lg:hidden">
            <Logo name={brand.siteName} logoUrl={brand.logoUrl} />
          </div>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-[#5B6B60] hover:text-[#0B3D2E]"
          >
            <ArrowLeft className="size-4" /> Beranda
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
