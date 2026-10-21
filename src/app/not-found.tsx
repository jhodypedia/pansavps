import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-lg rounded-2xl border border-[#E3E8E4] p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#E7F4EC]">
          <Compass className="size-7 text-[#0B3D2E]" />
        </div>
        <p className="mt-6 font-display text-6xl font-bold tracking-tight text-[#0B3D2E]">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#101613]">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-2 text-sm text-[#5B6B60]">
          Tautan yang kamu buka mungkin sudah dipindahkan atau tidak pernah ada.
        </p>
        <Button asChild className="mt-6 bg-[#0B3D2E] hover:bg-[#0E4D38]">
          <Link href="/">
            <Home className="size-4" /> Kembali ke Beranda
          </Link>
        </Button>
      </div>
    </div>
  );
}
