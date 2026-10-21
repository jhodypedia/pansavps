import type { Metadata } from "next";
import { getPublicBrand } from "@/lib/settings";
import { NotFoundView } from "@/components/shared/not-found-view";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan",
};

export default function AdminNotFound() {
  const brand = getPublicBrand();

  return (
    <NotFoundView
      brandName={brand.siteName}
      logoUrl={brand.logoUrl}
      supportWhatsapp={brand.supportWhatsapp}
      embedded
    />
  );
}
