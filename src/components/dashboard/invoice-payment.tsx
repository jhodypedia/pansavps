"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Landmark, Loader2, Upload, Wallet } from "lucide-react";
import {
  createTopupAction,
  payInvoiceAction,
  uploadPaymentProofAction,
} from "@/server/actions/orders";
import { ActionButton } from "@/components/dashboard/action-button";
import { ActionForm } from "@/components/dashboard/action-form";
import { TripayChannelPicker } from "@/components/dashboard/tripay-channels";
import type { TripayChannel } from "@/lib/payments/types";
import { SubmitButton } from "@/components/shared/submit-button";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function InvoicePaymentPanel({
  invoiceId,
  amount,
  gatewayFee = 0,
  gatewayTotal,
  status,
  type,
  providers,
  tripayChannels,
  balance,
  bank,
  hasPendingProof,
  lastOnlineFailed = false,
  lastOnlineStatus,
}: {
  invoiceId: string;
  amount: number;
  gatewayFee?: number;
  gatewayTotal?: number;
  status: string;
  type: string;
  providers: { id: string; label: string; description: string }[];
  tripayChannels: TripayChannel[];
  balance: number;
  bank: { bank: string; accountNumber: string; accountName: string; instructions: string };
  hasPendingProof: boolean;
  lastOnlineFailed?: boolean;
  lastOnlineStatus?: string | null;
}) {
  const onlineEnabled =
    providers.some((provider) => provider.id === "tripay") && tripayChannels.length > 0;
  const manualEnabled = providers.some((provider) => provider.id === "manual");
  const canBalance = type !== "topup" && balance >= amount;
  const [method, setMethod] = useState<"balance" | "manual" | "tripay">(
    onlineEnabled
      ? "tripay"
      : canBalance
        ? "balance"
        : manualEnabled
          ? "manual"
          : "tripay",
  );
  const [tripayChannel, setTripayChannel] = useState(tripayChannels[0]?.code ?? "");
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlinePending, startOnlineTransition] = useTransition();
  const router = useRouter();

  if (status !== "unpaid") {
    return null;
  }

  const manual = method === "manual";

  function chooseOnlineChannel(code: string) {
    setMethod("tripay");
    setTripayChannel(code);
    setOnlineError(null);
  }

  function payOnline() {
    if (!tripayChannel) {
      setOnlineError("Pilih metode pembayaran online terlebih dahulu.");
      return;
    }
    setOnlineError(null);
    startOnlineTransition(async () => {
      try {
        const result = await payInvoiceAction(invoiceId, "tripay", tripayChannel);
        if (!result.ok) {
          setOnlineError(
            "Pembayaran online belum dapat diproses. Coba lagi atau gunakan transfer manual.",
          );
          return;
        }
        if (result.redirectTo) {
          if (/^https?:\/\//.test(result.redirectTo)) {
            window.location.assign(result.redirectTo);
            return;
          }
          router.push(result.redirectTo);
          return;
        }
        router.refresh();
      } catch {
        setOnlineError(
          "Pembayaran online belum dapat diproses. Coba lagi atau gunakan transfer manual.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      {lastOnlineFailed ? (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
          <p className="font-semibold">Pembayaran online belum selesai</p>
          <p className="mt-1 text-xs leading-relaxed">
            {lastOnlineStatus === "EXPIRED"
              ? "Transaksi online sebelumnya sudah kedaluwarsa."
              : "Transaksi online sebelumnya dibatalkan atau gagal di gateway."}{" "}
            Invoice ini masih aktif dan bisa kamu coba lagi dengan metode pembayaran di bawah.
          </p>
        </div>
      ) : null}

      {hasPendingProof ? (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
          Bukti transfer sudah diunggah dan sedang menunggu verifikasi admin. Kamu bisa mengunggah
          ulang jika ada kesalahan.
        </div>
      ) : null}

      {onlineEnabled ? (
        <div className="rounded-xl border border-[#CFE6D8] bg-[#F9FCFA] p-3">
          <div className="mb-2">
            <p className="text-sm font-semibold text-[#101613]">Pembayaran online</p>
            <p className="text-xs text-[#5B6B60]">
              Pilih QRIS, virtual account, atau gerai retail di bawah.
            </p>
          </div>
          <TripayChannelPicker
            channels={tripayChannels}
            value={method === "tripay" ? tripayChannel : ""}
            onChange={chooseOnlineChannel}
            showGroups={false}
          />
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#D8E2DB] bg-white px-3 py-2 text-xs">
            <span className="text-[#5B6B60]">Total di gateway</span>
            <span className="text-right font-bold text-[#0B3D2E]">
              {formatIDR(gatewayTotal ?? amount)}
              {gatewayFee > 0 ? (
                <span className="block text-[10px] font-medium text-[#8A9A90]">
                  termasuk biaya layanan {formatIDR(gatewayFee)}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}

      {type !== "topup" || manualEnabled ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-[#8A9A90] uppercase">
            {onlineEnabled ? "Atau metode lain" : "Metode pembayaran"}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {type !== "topup" ? (
              <button
                type="button"
                disabled={!canBalance}
                onClick={() => setMethod("balance")}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-50",
                  method === "balance"
                    ? "border-[#0B3D2E] bg-[#F3F9F5]"
                    : "border-[#E3E8E4] bg-white hover:border-[#BFE3CC]",
                )}
                aria-pressed={method === "balance"}
              >
                <Wallet className="mt-0.5 size-4 text-[#0B3D2E]" />
                <span>
                  <span className="block text-sm font-semibold text-[#101613]">Saldo akun (opsional)</span>
                  <span className="block text-xs text-[#5B6B60]">
                    Tersedia {formatIDR(balance)}
                    {!canBalance ? " · tidak cukup, pilih pembayaran langsung" : ""}
                  </span>
                </span>
              </button>
            ) : null}
            {manualEnabled ? (
              <button
                type="button"
                onClick={() => setMethod("manual")}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5 text-left",
                  method === "manual"
                    ? "border-[#0B3D2E] bg-[#F3F9F5]"
                    : "border-[#E3E8E4] bg-white hover:border-[#BFE3CC]",
                )}
                aria-pressed={method === "manual"}
              >
                <Landmark className="mt-0.5 size-4 text-[#0B3D2E]" />
                <span>
                  <span className="block text-sm font-semibold text-[#101613]">Transfer manual</span>
                  <span className="block text-xs text-[#5B6B60]">Verifikasi oleh admin</span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {method === "balance" ? (
        <ActionButton
          action={() => payInvoiceAction(invoiceId, "balance")}
          variant="default"
          size="lg"
          className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
          pendingText="Memproses pembayaran…"
          confirm={`Bayar ${formatIDR(amount)} menggunakan saldo akun?`}
        >
          <Wallet className="size-4" /> Bayar dengan saldo · {formatIDR(amount)}
        </ActionButton>
      ) : manual ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#BFE3CC] bg-[#F3F9F5] p-4">
            <p className="text-xs font-semibold tracking-wide text-[#0B3D2E] uppercase">Rekening tujuan</p>
            <div className="mt-2 space-y-1.5">
              <p className="text-sm font-bold text-[#101613]">{bank.bank}</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-lg font-bold tracking-wide text-[#101613]">
                  {bank.accountNumber}
                </code>
                <CopyButton value={bank.accountNumber} label="" size="icon-sm" />
              </div>
              <p className="text-sm text-[#5B6B60]">a.n. {bank.accountName}</p>
            </div>
            {bank.instructions ? (
              <p className="mt-3 border-t border-[#CFE6D8] pt-3 text-xs leading-relaxed text-[#5B6B60]">
                {bank.instructions}
              </p>
            ) : null}
          </div>

          <ActionForm action={uploadPaymentProofAction} resetOnSuccess>
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="senderName">Nama pengirim</Label>
                <Input id="senderName" name="senderName" placeholder="Nama sesuai rekening" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proof">Bukti transfer</Label>
                <Input
                  id="proof"
                  name="proof"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  required
                  className="file:mr-3 file:rounded file:border-0 file:bg-[#E7F4EC] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-[#0B3D2E]"
                />
                <p className="text-xs text-[#8A9A90]">PNG, JPG, WEBP, atau PDF. Maksimal 5 MB.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Catatan (opsional)</Label>
                <Input id="note" name="note" placeholder="Nomor referensi transfer" maxLength={300} />
              </div>
            </div>
            <SubmitButton pendingText="Mengunggah…" className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Upload className="size-4" /> Kirim bukti transfer
            </SubmitButton>
          </ActionForm>
        </div>
      ) : onlineEnabled ? (
        <div className="space-y-2">
          <Button
            type="button"
            onClick={payOnline}
            disabled={onlinePending || !tripayChannel}
            size="lg"
            className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
          >
            {onlinePending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {onlinePending ? "Memproses pembayaran…" : "Lanjutkan pembayaran"}
          </Button>
          {onlineError ? <p className="text-xs text-[#B91C1C]">{onlineError}</p> : null}
        </div>
      ) : (
        <p className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E]">
          Metode pembayaran belum tersedia. Hubungi support untuk bantuan.
        </p>
      )}
    </div>
  );
}

export function TopupQuickAmounts({
  disabled,
  tripayChannels,
}: {
  disabled: boolean;
  tripayChannels: TripayChannel[];
}) {
  const [amount, setAmount] = useState(100000);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[50000, 100000, 250000, 500000, 1000000, 2000000].map((value) => (
          <Button
            key={value}
            type="button"
            variant={amount === value ? "default" : "outline"}
            onClick={() => setAmount(value)}
            disabled={disabled}
            className={cn(
              amount === value
                ? "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
                : "border-[#D8E2DB] bg-white",
            )}
          >
            {formatIDR(value)}
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="custom-amount">Nominal lain</Label>
        <Input
          id="custom-amount"
          type="number"
          min={10000}
          max={50000000}
          step={10000}
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
        <p className="text-xs text-[#8A9A90]">Minimal Rp 10.000 · maksimal Rp 50.000.000.</p>
      </div>
      <TopupMethods amount={amount} disabled={disabled} tripayChannels={tripayChannels} />
    </div>
  );
}

function TopupMethods({
  amount,
  disabled,
  tripayChannels,
}: {
  amount: number;
  disabled: boolean;
  tripayChannels: TripayChannel[];
}) {
  const [method, setMethod] = useState("manual");
  const [tripayChannel, setTripayChannel] = useState(tripayChannels[0]?.code ?? "");
  return (
    <ActionForm action={createTopupAction}>
      <input type="hidden" name="amount" value={amount} />
      <div className="space-y-2">
        <Label htmlFor="topup-method">Metode</Label>
        <select
          id="topup-method"
          name="method"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm"
          disabled={disabled}
        >
          <option value="manual">Transfer manual</option>
          {tripayChannels.length > 0 ? <option value="tripay">Pembayaran online</option> : null}
        </select>
      </div>
      {method === "tripay" ? (
        <div className="mt-3 rounded-xl border border-[#CFE6D8] bg-[#F9FCFA] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-[#0B3D2E] uppercase">
              Pilih metode pembayaran
            </p>
          </div>
          <TripayChannelPicker
            channels={tripayChannels}
            value={tripayChannel}
            onChange={setTripayChannel}
          />
        </div>
      ) : null}
      <SubmitButton
        pendingText="Membuat invoice…"
        disabled={disabled || amount < 10000}
        className="mt-3 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
      >
        Top up {formatIDR(amount)}
      </SubmitButton>
    </ActionForm>
  );
}

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\u00a0/g, " ");
}
