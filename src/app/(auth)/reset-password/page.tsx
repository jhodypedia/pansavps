import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getTurnstileConfig } from "@/lib/turnstile";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset Password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;
  const captcha = getTurnstileConfig();

  if (!token) {
    return (
      <div>
        <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-[#FEF3C7] text-[#92400E]">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-bold text-[#101613]">Tautan tidak lengkap</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">
          Tautan reset password tidak valid. Minta tautan baru dari halaman lupa password.
        </p>
        <Link
          href="/forgot-password"
          className="mt-5 inline-flex text-sm font-semibold text-[#0B3D2E] hover:underline"
        >
          Minta tautan baru
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-wide text-[#16A34A] uppercase">Keamanan akun</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#101613]">Buat password baru</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">
          Gunakan password yang kuat dan belum pernah dipakai di layanan lain.
        </p>
      </div>
      <ResetPasswordForm token={token} captcha={captcha} />
    </div>
  );
}
