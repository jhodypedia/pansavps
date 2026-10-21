"use client";

import { useState } from "react";
import {
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  ServerCog,
  Trash2,
  Zap,
} from "lucide-react";
import type { Service, Snapshot } from "@/lib/db/schema";
import {
  serviceActionAction,
  revealPasswordAction,
  toggleAutoRenewAction,
} from "@/server/actions/services";
import { renewServiceAction, upgradeServiceAction } from "@/server/actions/orders";
import { ActionForm } from "@/components/dashboard/action-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { TripayChannelPicker } from "@/components/dashboard/tripay-channels";
import type { TripayChannel } from "@/lib/payments/types";
import { SubmitButton } from "@/components/shared/submit-button";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastError, toastSuccess } from "@/lib/toast";

type Provider = { id: string; label: string; description: string };

function Hidden({ serviceId, action }: { serviceId: string; action: string }) {
  return (
    <>
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}

export function QuickPowerActions({ service }: { service: Service }) {
  const disabled = !service.doDropletId;
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { action: "power_on", label: "Nyalakan", icon: Play },
        { action: "reboot", label: "Reboot", icon: RotateCcw },
        { action: "shutdown", label: "Shutdown", icon: Power },
        { action: "sync", label: "Sinkronkan", icon: RefreshCw },
      ].map((item) => (
        <ActionForm key={item.action} action={serviceActionAction} className="inline-flex">
          <Hidden serviceId={service.id} action={item.action} />
          <SubmitButton
            variant="outline"
            size="sm"
            disabled={disabled && item.action !== "sync"}
            pendingText="Memproses…"
            className="border-[#D8E2DB] bg-white"
          >
            <item.icon className="size-3.5" /> {item.label}
          </SubmitButton>
        </ActionForm>
      ))}
    </div>
  );
}

export function ResetPasswordButton({ serviceId }: { serviceId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-[#D8E2DB] bg-white">
          <KeyRound className="size-3.5" /> Reset password root
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password root?</DialogTitle>
          <DialogDescription>
            Password baru akan dibuat dan disimpan terenkripsi. Setelah reset, buka tab Akses untuk
            melihat password baru.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={serviceActionAction} onSuccess={() => setOpen(false)}>
          <Hidden serviceId={serviceId} action="password_reset" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <SubmitButton pendingText="Mereset…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              Ya, reset password
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function RenameDialog({ service }: { service: Service }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-[#D8E2DB] bg-white">
          <Pencil className="size-3.5" /> Ganti nama
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ganti nama server</DialogTitle>
          <DialogDescription>
            Nama hanya boleh huruf kecil, angka, dan strip. Nama ini juga menjadi hostname.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={serviceActionAction} onSuccess={() => setOpen(false)}>
          <Hidden serviceId={service.id} action="rename" />
          <div className="space-y-2">
            <Label htmlFor="rename-hostname">Nama baru</Label>
            <Input
              id="rename-hostname"
              name="name"
              defaultValue={service.hostname}
              pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
              required
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <SubmitButton pendingText="Menyimpan…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              Simpan nama
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function SnapshotDialog({ serviceId }: { serviceId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-[#D8E2DB] bg-white">
          <Camera className="size-3.5" /> Buat snapshot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buat snapshot</DialogTitle>
          <DialogDescription>
            Snapshot menyimpan kondisi disk saat ini. Proses dapat memakan waktu beberapa menit.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={serviceActionAction} onSuccess={() => setOpen(false)}>
          <Hidden serviceId={serviceId} action="snapshot" />
          <div className="space-y-2">
            <Label htmlFor="snapshot-name">Nama snapshot (opsional)</Label>
            <Input id="snapshot-name" name="name" placeholder="sebelum-update" maxLength={60} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <SubmitButton pendingText="Membuat…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              Buat snapshot
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function RebuildDialog({
  service,
  images,
}: {
  service: Service;
  images: { slug: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(service.osSlug);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]">
          <ServerCog className="size-3.5" /> Rebuild OS
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rebuild sistem operasi</DialogTitle>
          <DialogDescription>
            Semua data di disk akan dihapus dan diganti dengan OS baru. Tindakan ini tidak dapat
            dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={serviceActionAction} onSuccess={() => setOpen(false)}>
          <Hidden serviceId={service.id} action="rebuild" />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sistem operasi</Label>
              <Select value={image} onValueChange={setImage} name="image">
                <SelectTrigger>
                  <SelectValue placeholder="Pilih OS" />
                </SelectTrigger>
                <SelectContent>
                  {images.map((item) => (
                    <SelectItem key={item.slug} value={item.slug}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="image" value={image} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-rebuild">
                Ketik <span className="font-mono font-bold">{service.hostname}</span> untuk konfirmasi
              </Label>
              <Input id="confirm-rebuild" name="confirmHostname" autoComplete="off" className="font-mono" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <SubmitButton
              variant="destructive"
              pendingText="Merebuild…"
              disabled={image === ""}
            >
              Rebuild sekarang
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSnapshotButton({ serviceId, snapshot }: { serviceId: string; snapshot: Snapshot }) {
  return (
    <ActionForm action={serviceActionAction} className="inline-flex">
      <Hidden serviceId={serviceId} action="delete_snapshot" />
      <input type="hidden" name="snapshotId" value={snapshot.id} />
      <SubmitButton variant="ghost" size="sm" pendingText="Menghapus…" className="text-[#B91C1C] hover:bg-[#FEE2E2]">
        <Trash2 className="size-3.5" /> Hapus
      </SubmitButton>
    </ActionForm>
  );
}

export function RevealPassword({ serviceId, hasPassword }: { serviceId: string; hasPassword: boolean }) {
  const [state, setState] = useState<{ password?: string; error?: string }>({});
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

  async function reveal() {
    setPending(true);
    try {
      const result = await revealPasswordAction(serviceId);
      if (result.ok) {
        setState({ password: result.data?.password });
        setVisible(true);
        toastSuccess(result.message);
      } else {
        setState({ error: result.message });
        toastError(result.message);
      }
    } finally {
      setPending(false);
    }
  }

  if (!hasPassword) {
    return <p className="text-sm text-[#8A9A90]">Password belum tersedia untuk VPS ini.</p>;
  }
  if (state.password) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-[#BFE3CC] bg-[#F3F9F5] px-3 py-2">
          <code className="flex-1 font-mono text-sm break-all text-[#101613]">
            {visible ? state.password : "•".repeat(Math.min(24, state.password.length))}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <CopyButton value={state.password} label="" size="icon-sm" />
        </div>
        <p className="text-xs text-[#8A9A90]">
          Jangan bagikan password ini. Setelah login, segera ganti password atau gunakan SSH key.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={reveal}
        disabled={pending}
        variant="outline"
        className="border-[#D8E2DB] bg-white text-[#0B3D2E]"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        {pending ? "Membuka…" : "Tampilkan password root"}
      </Button>
      <p className="text-xs text-[#8A9A90]">
        Akses kredensial dicatat di log audit. Maksimal 5 kali per 10 menit.
      </p>
    </div>
  );
}

export function AutoRenewToggle({ serviceId, enabled }: { serviceId: string; enabled: boolean }) {
  return (
    <ActionButton
      action={() => toggleAutoRenewAction(serviceId, !enabled)}
      variant={enabled ? "outline" : "default"}
      className={enabled ? "border-[#D8E2DB] bg-white" : "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"}
    >
      {enabled ? "Matikan auto-renew" : "Aktifkan auto-renew"}
    </ActionButton>
  );
}

export function RenewServiceDialog({
  serviceId,
  hostname,
  prices,
  providers,
  tripayChannels,
  balance,
}: {
  serviceId: string;
  hostname: string;
  prices: { monthly: number; quarterly: number; yearly: number };
  providers: Provider[];
  tripayChannels: TripayChannel[];
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [cycle, setCycle] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
          <RefreshCw className="size-4" /> Perpanjang
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Perpanjang {hostname}</DialogTitle>
          <DialogDescription>
            Perpanjangan memperpanjang masa aktif dari tanggal berakhir saat ini.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={renewServiceAction} onSuccess={() => setOpen(false)}>
          <input type="hidden" name="serviceId" value={serviceId} />
          <div className="space-y-2">
            <Label>Siklus</Label>
            <Select value={cycle} onValueChange={(value) => setCycle(value as typeof cycle)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Bulanan — {formatPrice(prices.monthly)}</SelectItem>
                <SelectItem value="quarterly">3 Bulan — {formatPrice(prices.quarterly)}</SelectItem>
                <SelectItem value="yearly">Tahunan — {formatPrice(prices.yearly)}</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="cycle" value={cycle} />
          </div>
          <PaymentSelect
            providers={providers}
            tripayChannels={tripayChannels}
            balance={balance}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <SubmitButton pendingText="Memproses…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              Buat invoice perpanjangan
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function UpgradeServiceDialog({
  serviceId,
  currentPlanId,
  plans,
  balance,
}: {
  serviceId: string;
  currentPlanId: number;
  plans: { id: number; name: string; priceMonthly: number }[];
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const targets = plans.filter((plan) => plan.priceMonthly > (plans.find((p) => p.id === currentPlanId)?.priceMonthly ?? 0));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#D8E2DB] bg-white">
          <Zap className="size-4" /> Upgrade paket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upgrade paket</DialogTitle>
          <DialogDescription>
            Biaya dihitung prorata sisa masa aktif. Resize dilakukan otomatis setelah pembayaran.
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <p className="text-sm text-[#5B6B60]">Tidak ada paket yang lebih tinggi. Kamu sudah di paket tertinggi.</p>
        ) : (
          <ActionForm action={upgradeServiceAction} onSuccess={() => setOpen(false)}>
            <input type="hidden" name="serviceId" value={serviceId} />
            <div className="space-y-2">
              <Label>Paket tujuan</Label>
              <select
                name="targetPlanId"
                required
                defaultValue={targets[0]?.id}
                className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm"
              >
                {targets.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {formatPrice(plan.priceMonthly)}/bulan
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Metode pembayaran</Label>
              <select
                name="paymentMethod"
                defaultValue={balance >= 0 ? "balance" : "manual"}
                className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm"
              >
                <option value="balance">Saldo akun · {formatPrice(balance)} (opsional)</option>
                <option value="manual">Transfer manual</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <SubmitButton pendingText="Memproses…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                Buat invoice upgrade
              </SubmitButton>
            </DialogFooter>
          </ActionForm>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentSelect({
  providers,
  tripayChannels,
  balance,
}: {
  providers: Provider[];
  tripayChannels: TripayChannel[];
  balance: number;
}) {
  const [method, setMethod] = useState("balance");
  const [tripayChannel, setTripayChannel] = useState(tripayChannels[0]?.code ?? "");
  return (
    <div className="space-y-2">
      <Label>Metode pembayaran</Label>
      <select
        name="paymentMethod"
        value={method}
        onChange={(event) => setMethod(event.target.value)}
        className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm"
      >
        <option value="balance">Saldo akun · {formatPrice(balance)} (opsional)</option>
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.label}
          </option>
        ))}
      </select>
      {method === "tripay" ? (
        <div className="rounded-xl border border-[#CFE6D8] bg-[#F9FCFA] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-[#0B3D2E] uppercase">
              Channel pembayaran
            </p>
            <span className="text-[10px] font-medium text-[#8A9A90]">Pilih salah satu</span>
          </div>
          <TripayChannelPicker
            channels={tripayChannels}
            value={tripayChannel}
            onChange={setTripayChannel}
          />
        </div>
      ) : null}
      <p className="text-xs text-[#8A9A90]">
        Saldo tidak cukup? Pilih transfer manual atau pembayaran online. Tidak perlu top up saldo.
      </p>
    </div>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\u00a0/g, " ");
}
