import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Lupa Password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-wide text-[#16A34A] uppercase">Pemulihan akun</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#101613]">Lupa password?</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">
          Masukkan email terdaftar. Kami akan mengirim tautan untuk membuat password baru.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
