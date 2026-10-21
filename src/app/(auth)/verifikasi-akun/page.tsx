import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { VerifyAccountPanel } from "@/components/auth/verify-account-panel";

export const metadata: Metadata = { title: "Verifikasi Akun" };

export default async function VerifyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold tracking-wide text-[#16A34A] uppercase">Verifikasi</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#101613]">
          Verifikasi akun
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5B6B60]">
          Verifikasi via kode WhatsApp (prioritas) atau tautan email. Akun yang belum terverifikasi
          belum dapat melakukan pembelian.
        </p>
      </div>
      <VerifyAccountPanel token={params.token} signedIn={Boolean(user)} />
    </div>
  );
}
