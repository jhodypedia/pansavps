import Link from "next/link";
import { Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export function SiteFooter({
  brandName,
  logoUrl,
  tagline,
  email,
  whatsapp,
}: {
  brandName: string;
  logoUrl?: string | null;
  tagline: string;
  email: string;
  whatsapp: string;
}) {
  const waLink = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : undefined;
  return (
    <footer className="border-t border-[#E3E8E4] bg-white">
      <div className="ws-container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo name={brandName} logoUrl={logoUrl} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#5B6B60]">{tagline}</p>
          <div className="mt-5 flex flex-col gap-2 text-sm">
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-2 text-[#5B6B60] hover:text-[#0B3D2E]"
            >
              <Mail className="size-4" /> {email}
            </a>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#5B6B60] hover:text-[#0B3D2E]"
              >
                <MessageCircle className="size-4" /> WhatsApp support
              </a>
            ) : null}
          </div>
        </div>
        <FooterColumn
          title="Produk"
          links={[
            { label: "Harga VPS", href: "/pricing" },
            { label: "Fitur", href: "/fitur" },
            { label: "FAQ", href: "/faq" },
            { label: "Status layanan", href: "/status" },
          ]}
        />
        <FooterColumn
          title="Akun"
          links={[
            { label: "Masuk", href: "/login" },
            { label: "Daftar", href: "/register" },
            { label: "Lupa password", href: "/forgot-password" },
            { label: "Dashboard", href: "/dashboard" },
          ]}
        />
        <FooterColumn
          title="Legal"
          links={[
            { label: "Syarat & ketentuan", href: "/syarat-ketentuan" },
            { label: "Kebijakan privasi", href: "/kebijakan-privasi" },
            { label: "Kebijakan refund", href: "/kebijakan-refund" },
            { label: "SLA", href: "/sla" },
          ]}
        />
      </div>
      <div className="border-t border-[#E3E8E4]">
        <div className="ws-container flex flex-col items-start justify-between gap-3 py-5 text-xs text-[#5B6B60] sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {brandName}. Seluruh hak cipta dilindungi.
          </p>
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-[#16A34A]" /> Pembayaran diverifikasi manual & gateway resmi
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-[#101613]">{title}</h3>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-[#5B6B60] transition-colors hover:text-[#0B3D2E]">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
