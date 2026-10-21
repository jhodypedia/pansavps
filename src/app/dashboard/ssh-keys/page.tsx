import { KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sshKeys } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { addSshKeyAction, deleteSshKeyAction } from "@/server/actions/services";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/dashboard/section-card";
import { ActionForm } from "@/components/dashboard/action-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "SSH Keys" };

export default async function SshKeysPage() {
  const user = await requireUser();
  const keys = db
    .select()
    .from(sshKeys)
    .where(eq(sshKeys.userId, user.id))
    .orderBy(desc(sshKeys.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <PageHeader
        title="SSH keys"
        description="Simpan public key untuk akses VPS tanpa password. Maksimal 10 key per akun."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <SectionCard title="Key tersimpan" description={`${keys.length} dari 10 key terpakai.`} bodyClassName="p-0">
          {keys.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={KeyRound}
                title="Belum ada SSH key"
                description="Tambahkan public key agar bisa memilih akses SSH saat memesan VPS."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[#EDF1EE]">
              {keys.map((key) => (
                <li key={key.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                      <KeyRound className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#101613]">{key.name}</p>
                      <p className="mt-0.5 text-xs text-[#8A9A90]">
                        {key.fingerprint} · ditambahkan {formatDate(key.createdAt)}
                      </p>
                      <p className="mt-1 line-clamp-1 font-mono text-[11px] break-all text-[#8A9A90]">
                        {key.publicKey}
                      </p>
                    </div>
                  </div>
                  <ActionButton
                    action={deleteSshKeyAction.bind(null, key.id)}
                    confirm={`Hapus SSH key "${key.name}"? Key yang dipakai VPS aktif tidak dapat dihapus.`}
                    variant="ghost"
                    className="shrink-0 self-start text-[#B91C1C] hover:bg-[#FEE2E2]"
                  >
                    <Trash2 className="size-3.5" /> Hapus
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Tambah SSH key">
            <ActionForm action={addSshKeyAction} resetOnSuccess>
              <div className="space-y-2">
                <Label htmlFor="key-name">Nama key</Label>
                <Input id="key-name" name="name" placeholder="laptop-kantor" maxLength={60} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="public-key">Public key</Label>
                <textarea
                  id="public-key"
                  name="publicKey"
                  rows={5}
                  required
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... kamu@laptop"
                  className="w-full rounded-md border border-[#D8E2DB] bg-white px-3 py-2 font-mono text-xs"
                />
                <p className="text-xs text-[#8A9A90]">
                  Tempel isi file <code>~/.ssh/id_ed25519.pub</code>. Jangan kirim private key.
                </p>
              </div>
              <SubmitButton pendingText="Menyimpan…" className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                <Plus className="size-4" /> Simpan key
              </SubmitButton>
            </ActionForm>
          </SectionCard>

          <div className="rounded-2xl border border-[#BFE3CC] bg-[#F3F9F5] p-5 text-sm text-[#5B6B60]">
            <p className="flex items-center gap-2 font-bold text-[#0B3D2E]">
              <ShieldCheck className="size-4" /> Keamanan SSH
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
              <li>Gunakan passphrase pada private key.</li>
              <li>Nonaktifkan login password setelah key terpasang.</li>
              <li>Batasi akses port 22 dengan firewall.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
