import { redirect } from "next/navigation";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const query = params.token ? `?token=${encodeURIComponent(params.token)}` : "";
  redirect(`/verifikasi-akun${query}`);
}
