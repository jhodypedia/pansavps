import { getPublicBrand } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth";
import { PublicHeader } from "@/components/shared/public-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { AnnouncementBanner } from "@/components/shared/announcement-banner";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const brand = getPublicBrand();
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader
        brandName={brand.siteName}
        logoUrl={brand.logoUrl}
        signedIn={Boolean(user)}
        isAdmin={user?.role === "admin"}
      />
      <AnnouncementBanner
        active={brand.announcement.active}
        text={brand.announcement.text}
        link={brand.announcement.link}
        tone={brand.announcement.tone}
      />
      {brand.maintenance ? (
        <div className="border-b border-[#FDE68A] bg-[#FFFBEB] px-4 py-2 text-center text-sm font-medium text-[#92400E]">
          Mode pemeliharaan aktif. Beberapa fitur mungkin sementara tidak tersedia.
        </div>
      ) : null}
      <main className="flex-1">{children}</main>
      <SiteFooter
        brandName={brand.siteName}
        logoUrl={brand.logoUrl}
        tagline={brand.tagline}
        email={brand.supportEmail}
        whatsapp={brand.supportWhatsapp}
      />
    </div>
  );
}
