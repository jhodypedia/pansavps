"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, LayoutDashboard, LogIn, ArrowRight } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Beranda" },
  { href: "/fitur", label: "Fitur" },
  { href: "/pricing", label: "Harga" },
  { href: "/faq", label: "FAQ" },
  { href: "/kontak", label: "Kontak" },
];

export function PublicHeader({
  brandName,
  logoUrl,
  signedIn,
  isAdmin,
}: {
  brandName: string;
  logoUrl?: string | null;
  signedIn: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#E3E8E4] bg-white/95 backdrop-blur">
      <div className="ws-container flex h-16 items-center justify-between gap-4">
        <Logo name={brandName} logoUrl={logoUrl} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  active ? "bg-[#E7F4EC] text-[#0B3D2E]" : "text-[#5B6B60] hover:bg-[#F7F8F7] hover:text-[#101613]",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button asChild size="sm" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href={isAdmin ? "/admin" : "/dashboard"}>
                <LayoutDashboard className="size-4" /> {isAdmin ? "Admin" : "Dashboard"}
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-[#0B3D2E] hover:bg-[#F3F9F5]">
                <Link href="/login">
                  <LogIn className="size-4" /> Masuk
                </Link>
              </Button>
              <Button asChild size="sm" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                <Link href="/register">
                  Mulai sekarang <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Buka menu" className="border-[#D8E2DB]">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-white p-0">
              <SheetHeader className="border-b border-[#E3E8E4] p-5">
                <SheetTitle asChild>
                  <Logo name={brandName} logoUrl={logoUrl} />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4" aria-label="Navigasi seluler">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-xl px-4 py-3 text-sm font-medium",
                      pathname === link.href
                        ? "bg-[#E7F4EC] text-[#0B3D2E]"
                        : "text-[#5B6B60] hover:bg-[#F7F8F7] hover:text-[#101613]",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 border-t border-[#E3E8E4] p-4">
                {signedIn ? (
                  <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                    <Link href={isAdmin ? "/admin" : "/dashboard"} onClick={() => setOpen(false)}>
                      <LayoutDashboard className="size-4" /> Buka {isAdmin ? "Admin" : "Dashboard"}
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" className="border-[#D8E2DB]">
                      <Link href="/login" onClick={() => setOpen(false)}>
                        Masuk
                      </Link>
                    </Button>
                    <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                      <Link href="/register" onClick={() => setOpen(false)}>
                        Daftar gratis
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
