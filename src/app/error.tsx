"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Detail teknis hanya ke console, bukan ke UI.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-lg rounded-2xl border border-[#E3E8E4] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#FEE2E2]">
          <AlertTriangle className="size-7 text-[#DC2626]" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-[#101613]">
          Terjadi kendala teknis
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">
          Kami tidak bisa menyelesaikan permintaan ini. Coba muat ulang halaman. Jika masih
          berlanjut, hubungi tim support dengan menyertakan kode kendala di bawah.
        </p>
        {error.digest ? (
          <p className="mt-3 rounded-lg bg-[#F7F8F7] px-3 py-2 font-mono text-xs text-[#5B6B60]">
            Kode: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset} className="bg-[#0B3D2E] hover:bg-[#0E4D38]">
            <RotateCcw className="size-4" /> Coba lagi
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="size-4" /> Ke Beranda
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
