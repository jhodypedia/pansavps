import Link from "next/link";
import {
  Activity,
  Home,
  LifeBuoy,
  MessageCircle,
  ServerCrash,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotFoundView({
  brandName,
  logoUrl,
  supportWhatsapp,
  embedded = false,
}: {
  brandName: string;
  logoUrl?: string | null;
  supportWhatsapp?: string;
  embedded?: boolean;
}) {
  const waNumber = supportWhatsapp?.replace(/\D/g, "") ?? "";
  const waLink = waNumber ? `https://wa.me/${waNumber}` : null;

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden",
        embedded
          ? "flex min-h-[60vh] items-center rounded-2xl border border-[#E3E8E4] bg-[#F7FBF8]"
          : "min-h-screen bg-[#F7FBF8]",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-24 size-[28rem] rounded-full bg-[#DDF3E5] opacity-80 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-[#EAF6EE] opacity-90 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0B3D2E08_1px,transparent_1px),linear-gradient(to_bottom,#0B3D2E08_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      </div>

      <div
        className={cn(
          "relative z-10 mx-auto flex w-full flex-col",
          embedded
            ? "max-w-5xl px-6 py-12 sm:px-10"
            : "min-h-screen max-w-6xl px-6 py-6 sm:px-8 sm:py-8",
        )}
      >
        {!embedded ? (
          <header className="flex items-center justify-between gap-4">
            <Logo name={brandName} logoUrl={logoUrl} />
            <span className="hidden items-center gap-1.5 text-xs font-semibold text-[#5B6B60] sm:inline-flex">
              <ShieldCheck className="size-4 text-[#16A34A]" />
              Koneksi aman
            </span>
          </header>
        ) : null}

        <div className={cn("flex flex-1 items-center", !embedded && "py-12 sm:py-16")}>
          <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#BFE3CC] bg-white/80 px-3 py-1.5 text-[11px] font-bold tracking-[0.16em] text-[#0B3D2E] uppercase shadow-sm backdrop-blur">
                <span className="size-1.5 rounded-full bg-[#16A34A]" />
                404 · Halaman tidak ditemukan
              </p>

              <h1 className="mt-5 max-w-xl font-display text-4xl leading-[1.05] font-bold tracking-tight text-[#101613] sm:text-5xl lg:text-6xl">
                Tersesat di <span className="text-[#0B3D2E]">ruang server?</span>
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#5B6B60] sm:text-base">
                Halaman yang kamu cari tidak tersedia. Tautannya mungkin salah, sudah
                dipindahkan, atau tidak pernah ada. Tenang, layanan dan data akunmu tetap aman.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                  <Link href="/">
                    <Home className="size-4" /> Kembali ke Beranda
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-[#D8E2DB] bg-white text-[#0B3D2E] hover:bg-[#F3F9F5]"
                >
                  <Link href="/status">
                    <Activity className="size-4" /> Cek Status Layanan
                  </Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-[#5B6B60]">
                <span className="inline-flex items-center gap-2 font-medium">
                  <LifeBuoy className="size-4 text-[#0B3D2E]" />
                  Butuh bantuan?
                </span>
                {waLink ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-[#0B3D2E] underline decoration-[#BFE3CC] underline-offset-4 transition-colors hover:text-[#0E4D38]"
                  >
                    <MessageCircle className="size-4" /> WhatsApp support
                  </a>
                ) : null}
                <Link
                  href="/kontak"
                  className="font-semibold text-[#0B3D2E] underline decoration-[#BFE3CC] underline-offset-4 transition-colors hover:text-[#0E4D38]"
                >
                  Hubungi kami
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:mr-0">
              <div className="absolute -inset-3 rounded-[2rem] bg-[#BFE3CC]/40 blur-2xl" />
              <div className="relative overflow-hidden rounded-3xl bg-[#0B3D2E] p-5 text-white shadow-[0_30px_70px_-30px_rgba(11,61,46,0.65)] ring-1 ring-[#0B3D2E]/20">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <span className="flex items-center gap-1.5" aria-hidden>
                    <span className="size-2 rounded-full bg-[#F87171]" />
                    <span className="size-2 rounded-full bg-[#FBBF24]" />
                    <span className="size-2 rounded-full bg-[#4ADE80]" />
                  </span>
                  <span className="font-mono text-[10px] tracking-wide text-white/45">
                    request.log
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-white/70">
                    404
                  </span>
                </div>

                <div className="mt-4 space-y-2 font-mono text-[11px] leading-6 sm:text-xs">
                  <p>
                    <span className="text-[#7DE2B0]">$</span>{" "}
                    <span className="text-white/85">curl -I /halaman-ini</span>
                  </p>
                  <p className="text-[#A7C4B7]">
                    HTTP/2 <span className="font-bold text-[#FCA5A5]">404</span> Not Found
                  </p>
                  <p className="text-[#A7C4B7]">
                    route ........ <span className="text-[#FCA5A5]">tidak tersedia</span>
                  </p>
                  <p className="text-[#A7C4B7]">
                    status ....... <span className="text-[#7DE2B0]">sistem normal</span>
                  </p>
                  <p>
                    <span className="text-[#7DE2B0]">$</span>{" "}
                    <span className="text-white/85">cd /beranda</span>
                  </p>
                  <p className="inline-flex items-center gap-1 text-white/70">
                    <span className="animate-pulse">▌</span>
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#7DE2B0]">
                    <ServerCrash className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">Tidak ada data yang hilang</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/60">
                      Server dan layananmu tetap berjalan normal.
                    </p>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 rounded-2xl border border-[#E3E8E4] bg-white px-4 py-3 shadow-[0_18px_45px_-24px_rgba(11,61,46,0.45)]">
                <p className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#8A9A90] uppercase">
                  Error code
                </p>
                <p className="font-display text-2xl leading-none font-bold text-[#0B3D2E]">
                  404
                </p>
              </div>
            </div>
          </div>
        </div>

        {!embedded ? (
          <footer className="flex flex-col gap-2 border-t border-[#D8E2DB]/70 py-5 text-xs text-[#8A9A90] sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {brandName}. Seluruh hak cipta dilindungi.
            </p>
            <p className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-[#16A34A]" />
              Koneksi aman · 404 bukan kesalahanmu.
            </p>
          </footer>
        ) : null}
      </div>
    </section>
  );
}
