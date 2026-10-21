import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");
  const params = await searchParams;

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-wide text-[#16A34A] uppercase">Selamat datang kembali</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#101613]">Masuk ke akun</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">
          Kelola server, invoice, dan saldo dari satu tempat.
        </p>
      </div>
      <LoginForm next={params.next} />
    </div>
  );
}
