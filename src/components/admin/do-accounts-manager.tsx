"use client";

import { KeyRound, Plus, Server, Star, Trash2 } from "lucide-react";
import type { DoAccountView } from "@/lib/do-account-types";
import {
  deleteDoAccountAction,
  saveDoAccountAction,
  setDefaultDoAccountAction,
  testDoConnectionAction,
} from "@/server/actions/admin";
import { ActionButton } from "@/components/dashboard/action-button";
import { ActionForm } from "@/components/dashboard/action-form";
import { SectionCard } from "@/components/dashboard/section-card";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function AccountFields({
  account,
}: {
  account?: DoAccountView;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`do-account-name-${account?.id ?? "new"}`}>Nama akun</Label>
          <Input
            id={`do-account-name-${account?.id ?? "new"}`}
            name="name"
            required
            defaultValue={account?.name}
            placeholder="DigitalOcean Utama"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`do-account-token-${account?.id ?? "new"}`}>
            Personal access token
          </Label>
          <Input
            id={`do-account-token-${account?.id ?? "new"}`}
            name="token"
            type="password"
            autoComplete="off"
            required={!account}
            placeholder={account ? "•••••••• (kosongkan jika tetap)" : "dop_v1_…"}
          />
          <p className="text-xs text-[#8A9A90]">
            Token disimpan terenkripsi. Gunakan token dengan akses read/write droplet.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-[#E3E8E4] bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            name="isDefault"
            value="true"
            defaultChecked={account?.isDefault ?? false}
            className="accent-[#0B3D2E]"
          />
          Jadikan akun default
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-[#E3E8E4] bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={account?.isActive ?? true}
            className="accent-[#0B3D2E]"
          />
          Aktif untuk provisioning
        </label>
      </div>
    </>
  );
}

export function DoAccountsManager({ accounts }: { accounts: DoAccountView[] }) {
  return (
    <SectionCard
      title="Akun DigitalOcean"
      description="Kelola beberapa token DigitalOcean. Provisioning memakai akun default lebih dulu, lalu otomatis mencoba akun aktif lain jika kapasitas penuh."
    >
      <div className="space-y-4">
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D8E2DB] bg-[#F9FBFA] p-5 text-sm text-[#5B6B60]">
            Belum ada akun. Tambahkan token DigitalOcean di bawah. Mode mock tetap aktif jika
            diaktifkan pada preferensi provisioning.
          </div>
        ) : null}

        {accounts.map((account) => (
          <div key={account.id} className="rounded-xl border border-[#E3E8E4] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[#E7F4EC] text-[#0B3D2E]">
                  <Server className="size-4" />
                </span>
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#101613]">
                    {account.name}
                    {account.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F4EC] px-2 py-0.5 text-[10px] font-semibold text-[#0B3D2E]">
                        <Star className="size-3" /> Default
                      </span>
                    ) : null}
                    <span
                      className={
                        account.isActive
                          ? "rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-semibold text-[#166534]"
                          : "rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#6B7280]"
                      }
                    >
                      {account.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-[#8A9A90]">
                    <KeyRound className="size-3" /> {account.tokenHint}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8A9A90]">
                    Ditambahkan {new Date(account.createdAt).toLocaleDateString("id-ID")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  action={() => testDoConnectionAction(account.id)}
                  className="border-[#BFE3CC] bg-white text-[#0B3D2E]"
                  pendingText="Menguji…"
                >
                  Uji koneksi
                </ActionButton>
                {!account.isDefault ? (
                  <ActionButton
                    action={() => setDefaultDoAccountAction(account.id)}
                    className="border-[#D8E2DB] bg-white"
                    pendingText="Menyimpan…"
                  >
                    <Star className="size-3.5" /> Jadikan default
                  </ActionButton>
                ) : null}
                <ActionButton
                  action={() => deleteDoAccountAction(account.id)}
                  variant="outline"
                  className="border-[#FECACA] text-[#991B1B] hover:bg-[#FEF2F2]"
                  pendingText="Menghapus…"
                  confirm={`Hapus akun ${account.name}?`}
                >
                  <Trash2 className="size-3.5" /> Hapus
                </ActionButton>
              </div>
            </div>

            <details className="mt-4 rounded-lg border border-[#EDF1EE] bg-[#FBFCFB]">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#0B3D2E]">
                Edit akun
              </summary>
              <div className="border-t border-[#EDF1EE] p-3">
                <ActionForm action={saveDoAccountAction.bind(null, account.id)} inlineError>
                  <AccountFields account={account} />
                  <SubmitButton pendingText="Menyimpan…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                    Simpan perubahan
                  </SubmitButton>
                </ActionForm>
              </div>
            </details>
          </div>
        ))}

        <details open={accounts.length === 0} className="rounded-xl border border-[#CFE6D8] bg-[#F3F9F5]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-[#0B3D2E]">
            <Plus className="size-4" /> Tambah akun DigitalOcean
          </summary>
          <div className="border-t border-[#CFE6D8] p-4">
            <ActionForm action={saveDoAccountAction.bind(null, null)} inlineError resetOnSuccess>
              <AccountFields />
              <SubmitButton pendingText="Menambahkan…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                <Plus className="size-4" /> Tambah akun
              </SubmitButton>
            </ActionForm>
          </div>
        </details>
      </div>
    </SectionCard>
  );
}
