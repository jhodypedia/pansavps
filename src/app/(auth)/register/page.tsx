import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTurnstileConfig } from "@/lib/turnstile";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Daftar" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; plan?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");
  const params = await searchParams;
  const captcha = getTurnstileConfig();

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-wide text-[#16A34A] uppercase">Daftar gratis</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#101613]">Buat akun baru</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">
          Hanya butuh satu menit. Tanpa kartu kredit sampai kamu memesan server.
        </p>
      </div>
      <RegisterForm next={params.next} planSlug={params.plan} captcha={captcha} />
    </div>
  );
}
