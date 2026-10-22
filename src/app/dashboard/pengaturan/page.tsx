import Link from "next/link";
import {
  BadgeCheck,
  KeyRound,
  Laptop,
  LogOut,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  currentSessionToken,
  isUserVerified,
  listActiveSessions,
  requireUser,
} from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import {
  changePasswordAction,
  revokeOtherSessionsAction,
  updateProfileAction,
} from "@/server/actions/account";
import { formatDateTime, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ActionForm } from "@/components/dashboard/action-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pengaturan Akun" };

const tabs = [
  { key: "profil", label: "Profil", icon: UserRound },
  { key: "keamanan", label: "Keamanan", icon: ShieldCheck },
  { key: "sesi", label: "Sesi & perangkat", icon: MonitorSmartphone },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { tab: tabParam } = await searchParams;
  const tab = tabs.some((item) => item.key === tabParam) ? tabParam! : "profil";
  const fullUser = db.select().from(users).where(eq(users.id, user.id)).get();
  const sessions = await listActiveSessions(user.id);
  const token = await currentSessionToken();
  const currentHash = token ? sha256(token) : "";
  const sorted = [...sessions].sort(
    (a, b) => Number(b.tokenHash === currentHash) - Number(a.tokenHash === currentHash),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan akun"
        description="Kelola profil, keamanan, dan sesi perangkat yang masuk ke akunmu."
      />

      <div className="flex gap-1 overflow-x-auto border-b border-[#E3E8E4] pb-px">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={`/dashboard/pengaturan?tab=${item.key}`}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              tab === item.key
                ? "border-[#0B3D2E] text-[#0B3D2E]"
                : "border-transparent text-[#5B6B60] hover:text-[#0B3D2E]",
            )}
            aria-current={tab === item.key ? "page" : undefined}
          >
            <item.icon className="size-4" /> {item.label}
          </Link>
        ))}
      </div>

      {tab === "profil" ? (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <SectionCard title="Profil" description="Nama dan nomor WhatsApp yang dipakai untuk notifikasi.">
            <ActionForm action={updateProfileAction}>
              <div className="space-y-2">
                <Label htmlFor="name">Nama lengkap</Label>
                <Input id="name" name="name" defaultValue={fullUser?.name ?? user.name} required maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled className="bg-[#F7F8F7]" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs text-[#8A9A90]">
                    {user.emailVerifiedAt ? (
                      <>
                        <BadgeCheck className="size-3.5 text-[#16A34A]" /> Email terverifikasi
                      </>
                    ) : (
                      <>
                        <Mail className="size-3.5 text-[#D97706]" /> Email belum terverifikasi
                      </>
                    )}
                  </p>
                  {!user.emailVerifiedAt ? (
                    <Link
                      href="/verifikasi-akun"
                      className="inline-flex items-center gap-1 rounded-lg bg-[#E7F4EC] px-2.5 py-1 text-[11px] font-bold text-[#0B3D2E] transition-colors hover:bg-[#DDF0E4]"
                    >
                      <ShieldCheck className="size-3" /> Verifikasi email
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Nomor WhatsApp</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={fullUser?.phone ?? ""}
                  placeholder="08123456789"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs text-[#8A9A90]">
                    {fullUser?.phoneVerifiedAt ? (
                      <>
                        <BadgeCheck className="size-3.5 text-[#16A34A]" /> WhatsApp terverifikasi
                      </>
                    ) : (
                      <>
                        <MessageCircle className="size-3.5 text-[#D97706]" /> WhatsApp belum terverifikasi
                      </>
                    )}
                  </p>
                  {!fullUser?.phoneVerifiedAt ? (
                    <Link
                      href="/verifikasi-akun"
                      className="inline-flex items-center gap-1 rounded-lg bg-[#E7F4EC] px-2.5 py-1 text-[11px] font-bold text-[#0B3D2E] transition-colors hover:bg-[#DDF0E4]"
                    >
                      <ShieldCheck className="size-3" /> Verifikasi WhatsApp
                    </Link>
                  ) : null}
                </div>
                <p className="text-xs text-[#8A9A90]">
                  Isi nomor WhatsApp buat verifikasi. Format 08xx atau 628xx.
                </p>
              </div>
              <SubmitButton pendingText="Menyimpan…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                Simpan profil
              </SubmitButton>
            </ActionForm>
          </SectionCard>

          <SectionCard title="Informasi akun">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[#8A9A90]">ID akun</dt>
                <dd className="mt-0.5 font-mono text-xs break-all text-[#101613]">{user.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#8A9A90]">Bergabung</dt>
                <dd className="mt-0.5 font-semibold text-[#101613]">{formatDateTime(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#8A9A90]">Peran</dt>
                <dd className="mt-0.5 font-semibold text-[#101613] capitalize">{user.role}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#8A9A90]">Status</dt>
                <dd className="mt-0.5 font-semibold text-[#15803D]">Aktif</dd>
              </div>
            </dl>
            {!isUserVerified(user) ? (
              <Button asChild variant="outline" className="mt-4 w-full border-[#D8E2DB] bg-white">
                <Link href="/verifikasi-akun">Verifikasi akun sekarang</Link>
              </Button>
            ) : null}
          </SectionCard>
        </div>
      ) : null}

      {tab === "keamanan" ? (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <SectionCard title="Ganti password" description="Gunakan password kuat dan unik.">
            <ActionForm action={changePasswordAction}>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Password lama</Label>
                <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password baru</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="text-xs text-[#8A9A90]">Minimal 8 karakter, mengandung huruf dan angka.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi password baru</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <SubmitButton pendingText="Menyimpan…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                Ubah password
              </SubmitButton>
            </ActionForm>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard title="Sesi lain">
              <p className="text-sm leading-relaxed text-[#5B6B60]">
                Keluarkan semua perangkat lain yang masih masuk ke akun ini. Sesi yang sekarang tetap aktif.
              </p>
              <ActionButton
                action={revokeOtherSessionsAction}
                variant="outline"
                className="mt-4 border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]"
                confirm="Keluarkan semua sesi lain?"
              >
                <LogOut className="size-4" /> Keluarkan sesi lain
              </ActionButton>
            </SectionCard>
            <div className="rounded-2xl border border-[#BFE3CC] bg-[#F3F9F5] p-5 text-sm text-[#5B6B60]">
              <p className="flex items-center gap-2 font-bold text-[#0B3D2E]">
                <KeyRound className="size-4" /> Tips keamanan
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                <li>Jangan gunakan password yang sama di layanan lain.</li>
                <li>Periksa sesi perangkat secara berkala.</li>
                <li>Aktifkan verifikasi email untuk pemulihan akun.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "sesi" ? (
        <SectionCard title="Sesi aktif" description={`${sessions.length} sesi ditemukan.`} bodyClassName="p-0">
          <ul className="divide-y divide-[#EDF1EE]">
            {sorted.map((session) => {
              const isCurrent = session.tokenHash === currentHash;
              return (
                <li key={session.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                      <Laptop className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#101613]">
                        {isCurrent ? "Perangkat ini" : "Perangkat lain"}
                        {isCurrent ? (
                          <span className="ml-2 rounded-full bg-[#E7F4EC] px-2 py-0.5 text-[10px] font-bold text-[#0B3D2E]">
                            AKTIF
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[#5B6B60]">{session.userAgent}</p>
                      <p className="mt-0.5 text-xs text-[#8A9A90]">
                        {session.ip} · masuk {formatRelative(session.createdAt)} · berakhir{" "}
                        {formatDateTime(session.expiresAt)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[#E3E8E4] p-5">
            <ActionButton
              action={revokeOtherSessionsAction}
              variant="outline"
              className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]"
              confirm="Keluarkan semua sesi lain?"
            >
              <LogOut className="size-4" /> Keluarkan semua sesi lain
            </ActionButton>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
