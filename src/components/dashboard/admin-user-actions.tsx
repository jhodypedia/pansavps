"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import { adjustBalanceAction, userManagementAction } from "@/server/actions/admin";
import { ActionForm } from "@/components/dashboard/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

export function UserAdminActions({
  userId,
  role,
  status,
  isSelf,
  verified,
}: {
  userId: string;
  role: string;
  status: string;
  isSelf: boolean;
  verified: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <ActionForm action={userManagementAction} className="inline-flex">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="action" value={status === "active" ? "suspend" : "activate"} />
          <SubmitButton
            variant="outline"
            size="sm"
            pendingText="Memproses…"
            disabled={isSelf}
            className="border-[#D8E2DB] bg-white"
          >
            {status === "active" ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
            {status === "active" ? "Tangguhkan" : "Aktifkan"}
          </SubmitButton>
        </ActionForm>

        <ActionForm action={userManagementAction} className="inline-flex">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="action" value={role === "admin" ? "remove_admin" : "make_admin"} />
          <SubmitButton
            variant="outline"
            size="sm"
            pendingText="Memproses…"
            disabled={isSelf}
            className="border-[#D8E2DB] bg-white"
          >
            {role === "admin" ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
            {role === "admin" ? "Cabut admin" : "Jadikan admin"}
          </SubmitButton>
        </ActionForm>

        <ActionForm action={userManagementAction} className="inline-flex">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="action" value="reset_password" />
          <SubmitButton variant="outline" size="sm" pendingText="Mereset…" className="border-[#D8E2DB] bg-white">
            <KeyRound className="size-3.5" /> Reset password
          </SubmitButton>
        </ActionForm>

        {!verified ? (
          <ActionForm action={userManagementAction} className="inline-flex">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="action" value="verify" />
            <SubmitButton variant="outline" size="sm" pendingText="Memverifikasi…" className="border-[#BFE3CC] bg-[#F3F9F5] text-[#0B3D2E]">
              <ShieldCheck className="size-3.5" /> Verifikasi manual
            </SubmitButton>
          </ActionForm>
        ) : null}
      </div>
      <p className="text-xs text-[#8A9A90]">
        Reset password menampilkan password sementara sekali. Sesi pengguna akan dikeluarkan. Verifikasi
        manual dipakai jika WhatsApp/email belum tersedia.
      </p>
    </div>
  );
}

export function AdjustBalanceForm({ userId, balance }: { userId: string; balance: number }) {
  const [kind, setKind] = useState<"add" | "subtract">("add");
  const [amount, setAmount] = useState("");
  const signed = kind === "add" ? Math.abs(Number(amount) || 0) : -Math.abs(Number(amount) || 0);
  return (
    <ActionForm action={adjustBalanceAction} resetOnSuccess>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="amount" value={signed} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Jenis</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "add", label: "Tambah" },
              { key: "subtract", label: "Kurangi" },
            ].map((item) => (
              <Button
                key={item.key}
                type="button"
                variant={kind === item.key ? "default" : "outline"}
                onClick={() => setKind(item.key as "add" | "subtract")}
                className={kind === item.key ? "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]" : "border-[#D8E2DB] bg-white"}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`amount-${userId}`}>Nominal (Rp)</Label>
          <Input
            id={`amount-${userId}`}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            type="number"
            min={1000}
            step={1000}
            required
            placeholder="50000"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`note-${userId}`}>Catatan</Label>
        <Input id={`note-${userId}`} name="note" required minLength={5} placeholder="Kompensasi downtime / koreksi saldo" />
      </div>
      <SubmitButton pendingText="Menyimpan…" className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
        <Wallet className="size-4" /> Sesuaikan saldo (saat ini {formatIDR(balance)})
      </SubmitButton>
      <p className="text-xs text-[#8A9A90]">
        Penyesuaian tercatat di riwayat saldo dan audit log. Saldo tidak boleh negatif.
      </p>
    </ActionForm>
  );
}

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\u00a0/g, " ");
}
