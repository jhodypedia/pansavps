"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Link2,
  Loader2,
  LogOut,
  MessageCircle,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
} from "lucide-react";
import {
  retryWaMessagesAction,
  saveWaTemplateAction,
  waConnectAction,
  waLogoutAction,
  waRefreshStatusAction,
  waTestMessageAction,
} from "@/server/actions/admin";
import { ActionForm } from "@/components/dashboard/action-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess } from "@/lib/toast";

export function WhatsAppConnect({
  status,
  phone,
  profileName,
  connectedAt,
  lastQr,
  pairingCode,
  lastError,
}: {
  status: string;
  phone: string | null;
  profileName: string | null;
  connectedAt: string | null;
  lastQr: string | null;
  pairingCode: string | null;
  lastError: string | null;
}) {
  const [mode, setMode] = useState<"qr" | "pairing">("qr");
  const [phoneInput, setPhoneInput] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const connected = status === "connected";
  const waiting = ["qr_pending", "pairing_pending", "connecting"].includes(status);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toastSuccess(result.message);
        router.refresh();
      } else {
        toastError(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E3E8E4] bg-[#F7F8F7] p-3">
        <span
          className={`size-2.5 rounded-full ${
            connected ? "bg-[#16A34A]" : waiting ? "bg-[#D97706]" : "bg-[#8A9A90]"
          }`}
        />
        <p className="text-sm font-semibold text-[#101613] capitalize">{status.replace("_", " ")}</p>
        {connected && phone ? (
          <p className="text-xs text-[#5B6B60]">
            {profileName ?? "WhatsApp"} · +{phone}
            {connectedAt ? ` · sejak ${connectedAt}` : ""}
          </p>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <ActionButton
            action={() => waRefreshStatusAction()}
            variant="outline"
            className="border-[#D8E2DB] bg-white"
            pendingText="Memeriksa…"
          >
            <RefreshCw className="size-3.5" /> Segarkan status
          </ActionButton>
          {connected ? (
            <ActionButton
              action={() => waLogoutAction()}
              variant="outline"
              className="border-[#FECACA] text-[#991B1B] hover:bg-[#FEF2F2]"
              confirm="Putuskan koneksi WhatsApp? Notifikasi tidak akan terkirim sampai terhubung lagi."
              pendingText="Memutuskan…"
            >
              <LogOut className="size-3.5" /> Putuskan
            </ActionButton>
          ) : null}
        </div>
      </div>

      {lastError ? (
        <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
          {lastError}
        </p>
      ) : null}

      {!connected ? (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D8E2DB] bg-white p-5 text-center">
            {lastQr && lastQr.startsWith("data:image") ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lastQr} alt="QR WhatsApp" className="size-60 rounded-xl border border-[#E3E8E4]" />
                <p className="mt-3 text-xs text-[#5B6B60]">Pindai dengan WhatsApp → Perangkat tertaut.</p>
              </>
            ) : pairingCode ? (
              <>
                <Smartphone className="size-8 text-[#0B3D2E]" />
                <p className="mt-2 text-xs text-[#5B6B60]">Kode pairing</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.25em] text-[#101613]">{pairingCode}</p>
                <p className="mt-2 text-xs text-[#8A9A90]">
                  Masukkan kode ini di WhatsApp → Perangkat tertaut → Tautkan dengan nomor telepon.
                </p>
              </>
            ) : (
              <>
                <QrCode className="size-10 text-[#8A9A90]" />
                <p className="mt-3 text-sm font-semibold text-[#101613]">Belum terhubung</p>
                <p className="mt-1 text-xs leading-relaxed text-[#5B6B60]">
                  Jalankan worker (`npm run wa:worker`) lalu minta QR atau kode pairing.
                </p>
                {waiting ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-[#92400E]">
                    <Loader2 className="size-3.5 animate-spin" /> Menunggu kode dari worker…
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "qr" ? "default" : "outline"}
                onClick={() => setMode("qr")}
                className={mode === "qr" ? "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]" : "border-[#D8E2DB] bg-white"}
              >
                <QrCode className="size-4" /> QR code
              </Button>
              <Button
                type="button"
                variant={mode === "pairing" ? "default" : "outline"}
                onClick={() => setMode("pairing")}
                className={mode === "pairing" ? "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]" : "border-[#D8E2DB] bg-white"}
              >
                <Smartphone className="size-4" /> Kode pairing
              </Button>
            </div>

            {mode === "pairing" ? (
              <div className="space-y-2">
                <Label htmlFor="wa-phone">Nomor WhatsApp toko</Label>
                <Input
                  id="wa-phone"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  placeholder="6281234567890"
                  inputMode="tel"
                />
                <p className="text-xs text-[#8A9A90]">Gunakan format internasional tanpa tanda +.</p>
              </div>
            ) : (
              <p className="rounded-xl border border-[#E3E8E4] bg-[#F7F8F7] p-3 text-xs leading-relaxed text-[#5B6B60]">
                QR code berlaku singkat. Jika kedaluwarsa, minta ulang. Pastikan worker berjalan di
                server yang sama dengan aplikasi.
              </p>
            )}

            <Button
              type="button"
              disabled={pending || (mode === "pairing" && phoneInput.replace(/\D/g, "").length < 9)}
              onClick={() =>
                run(() => waConnectAction(mode, mode === "pairing" ? phoneInput : undefined))
              }
              className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              {pending ? "Menghubungkan…" : mode === "qr" ? "Minta QR code" : "Minta kode pairing"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#BFE3CC] bg-[#F3F9F5] p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-[#0B3D2E]">
              <MessageCircle className="size-4" /> Terhubung
            </p>
            <p className="mt-1 text-xs text-[#5B6B60]">
              Pesan dari antrean akan dikirim otomatis oleh worker. Pantau status di halaman log.
            </p>
          </div>
          <div className="rounded-xl border border-[#E3E8E4] bg-white p-4">
            <p className="text-xs text-[#5B6B60]">Nomor terhubung</p>
            <p className="mt-1 font-mono text-sm font-bold text-[#101613]">{phone ? `+${phone}` : "—"}</p>
            <p className="mt-1 text-xs text-[#8A9A90]">{profileName ?? ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function WhatsAppTestForm() {
  return (
    <ActionForm action={waTestMessageAction} inlineError resetOnSuccess>
      <div className="space-y-2">
        <Label htmlFor="wa-test-to">Nomor tujuan</Label>
        <Input id="wa-test-to" name="to" placeholder="6281234567890" required inputMode="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wa-test-message">Pesan</Label>
        <Textarea id="wa-test-message" name="message" rows={3} required defaultValue="Tes koneksi WhatsApp berhasil." />
      </div>
      <SubmitButton pendingText="Mengirim…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
        <Send className="size-4" /> Kirim pesan uji
      </SubmitButton>
    </ActionForm>
  );
}

export function RetryFailedWa({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <ActionButton
      action={() => retryWaMessagesAction(ids)}
      className="border-[#BFE3CC] bg-white text-[#0B3D2E]"
      pendingText="Mengantrekan…"
    >
      <RefreshCw className="size-3.5" /> Coba ulang {ids.length} pesan gagal
    </ActionButton>
  );
}

export function WaTemplateEditor({
  templateKey,
  title,
  body,
  isActive,
  isCustom,
}: {
  templateKey: string;
  title: string;
  body: string;
  isActive: boolean;
  isCustom: boolean;
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-3.5 hover:bg-[#F9FBFA]">
        <div>
          <p className="text-sm font-semibold text-[#101613]">{title}</p>
          <p className="font-mono text-[10px] text-[#8A9A90]">{templateKey}</p>
        </div>
        <span className="text-xs text-[#8A9A90]">
          {isCustom ? "Kustom" : "Default"} · {isActive ? "Aktif" : "Nonaktif"}
        </span>
      </summary>
      <div className="border-t border-[#EDF1EE] bg-[#FBFCFB] px-5 py-4">
        <ActionForm action={saveWaTemplateAction.bind(null, templateKey)} inlineError>
          <div className="space-y-2">
            <Label htmlFor={`wa-title-${templateKey}`}>Judul internal</Label>
            <Input id={`wa-title-${templateKey}`} name="title" required defaultValue={title} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`wa-body-${templateKey}`}>Isi pesan</Label>
            <Textarea
              id={`wa-body-${templateKey}`}
              name="body"
              rows={7}
              required
              defaultValue={body}
              maxLength={4000}
              className="font-mono text-xs"
            />
            <p className="text-xs text-[#8A9A90]">
              Placeholder: {"{nama}"}, {"{order_number}"}, {"{nama_paket}"}, {"{ip}"}, {"{hostname}"},{" "}
              {"{total}"}, {"{jatuh_tempo}"}, {"{link}"}, {"{password}"}, {"{brand}"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-[#101613]">
              <input type="checkbox" name="isActive" value="true" defaultChecked={isActive} className="accent-[#0B3D2E]" />
              Template aktif
            </label>
            <SubmitButton variant="outline" pendingText="Menyimpan…" className="border-[#D8E2DB] bg-white">
              Simpan template
            </SubmitButton>
          </div>
        </ActionForm>
      </div>
    </details>
  );
}
