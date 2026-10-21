import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shared/providers";
import { getPublicBrand } from "@/lib/settings";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#0B3D2E",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = getPublicBrand();
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: {
      default: `${brand.siteName} — ${brand.tagline}`,
      template: `%s | ${brand.siteName}`,
    },
    description: brand.description,
    applicationName: brand.siteName,
    keywords: ["VPS", "cloud VPS", "VPS murah", "DigitalOcean", "server Indonesia", brand.siteName],
    authors: [{ name: brand.siteName }],
    openGraph: {
      type: "website",
      locale: "id_ID",
      siteName: brand.siteName,
      title: `${brand.siteName} — ${brand.tagline}`,
      description: brand.description,
      url: base,
    },
    twitter: {
      card: "summary_large_image",
      title: `${brand.siteName} — ${brand.tagline}`,
      description: brand.description,
    },
    icons: brand.faviconUrl ? { icon: brand.faviconUrl } : undefined,
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = getPublicBrand();
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jakarta.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-white font-sans text-[#101613]">
        <Providers brandName={brand.siteName}>{children}</Providers>
      </body>
    </html>
  );
}
