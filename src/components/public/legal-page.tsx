import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export type LegalSection = { heading: string; body: string[] };

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <section className="border-b border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container py-12 md:py-16">
          <Badge className="border border-[#CFE6D8] bg-white text-[#0B3D2E] hover:bg-white">Legal</Badge>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#101613] sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-[#5B6B60]">Terakhir diperbarui: {updated}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#5B6B60]">{intro}</p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="ws-container grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Daftar isi" className="hidden lg:block">
            <div className="sticky top-24 rounded-xl border border-[#E3E8E4] bg-white p-4">
              <p className="text-xs font-bold tracking-wide text-[#5B6B60] uppercase">Daftar isi</p>
              <ol className="mt-3 flex flex-col gap-2 text-sm">
                {sections.map((section, index) => (
                  <li key={section.heading}>
                    <a href={`#bagian-${index + 1}`} className="text-[#5B6B60] hover:text-[#0B3D2E] hover:underline">
                      {index + 1}. {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="max-w-3xl">
            <div className="space-y-8">
              {sections.map((section, index) => (
                <section key={section.heading} id={`bagian-${index + 1}`} className="scroll-mt-24">
                  <h2 className="font-display text-xl font-bold text-[#101613]">
                    {index + 1}. {section.heading}
                  </h2>
                  <div className="mt-2.5 space-y-3">
                    {section.body.map((paragraph) => (
                      <p key={paragraph} className="text-sm leading-7 text-[#5B6B60]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="mt-10 rounded-xl border border-[#E3E8E4] bg-[#F7F8F7] p-5 text-sm text-[#5B6B60]">
              Ada pertanyaan tentang dokumen ini?{" "}
              <Link href="/kontak" className="font-semibold text-[#0B3D2E] hover:underline">
                Hubungi kami
              </Link>
              .
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
