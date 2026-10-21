import type { Metadata } from "next";
import { getPublicBrand } from "@/lib/settings";
import { NotFoundView } from "@/components/shared/not-found-view";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan",
  description: "Halaman yang kamu cari tidak tersedia atau sudah dipindahkan.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const brand = getPublicBrand();

  return (
    <NotFoundView
      brandName={brand.siteName}
      logoUrl={brand.logoUrl}
      supportWhatsapp={brand.supportWhatsapp}
    />
  );
}
