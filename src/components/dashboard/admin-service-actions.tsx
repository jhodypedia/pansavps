"use client";

import { useState } from "react";
import {
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Play,
  Power,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { serviceActionAction, revealPasswordAction } from "@/server/actions/services";
import { ActionForm } from "@/components/dashboard/action-form";
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
import { toastError, toastSuccess } from "@/lib/toast";

function Hidden({ serviceId, action }: { serviceId: string; action: string }) {
  return (
    <>
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}

export function AdminServiceQuickActions({
  serviceId,
  status,
}: {
  serviceId: string;
  status: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { action: "power_on", label: "Nyalakan", icon: Play },
        { action: "reboot", label: "Reboot", icon: RotateCcw },
        { action: "shutdown", label: "Shutdown", icon: Power },
      ].map((item) => (
        <ActionForm key={item.action} action={serviceActionAction} className="inline-flex">
          <Hidden serviceId={serviceId} action={item.action} />
          <SubmitButton variant="outline" size="sm" pendingText="Memproses…" className="border-[#D8E2DB] bg-white">
            <item.icon className="size-3.5" /> {item.label}
          </SubmitButton>
        </ActionForm>
      ))}
      {status === "suspended" ? (
        <ActionForm action={serviceActionAction} className="inline-flex">
          <Hidden serviceId={serviceId} action="unsuspend" />
          <SubmitButton size="sm" pendingText="Mengaktifkan…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Play className="size-3.5" /> Aktifkan kembali
          </SubmitButton>
        </ActionForm>
      ) : (
        <ActionForm action={serviceActionAction} className="inline-flex">
          <Hidden serviceId={serviceId} action="suspend" />
          <SubmitButton variant="outline" size="sm" pendingText="Menangguhkan…" className="border-[#FDE68A] text-[#92400E] hover:bg-[#FEF3C7]">
            <Lock className="size-3.5" /> Tangguhkan
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function AdminTerminateDialog({ serviceId, hostname }: { serviceId: string; hostname: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]">
          <Trash2 className="size-4" /> Terminasi permanen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terminasi VPS</DialogTitle>
          <DialogDescription>
            Server akan dihapus permanen dan seluruh data ikut hilang. Tindakan ini tercatat di log.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={serviceActionAction} onSuccess={() => setOpen(false)}>
          <Hidden serviceId={serviceId} action="terminate" />
          <div className="space-y-2">
            <Label htmlFor="terminate-confirm">
              Ketik <span className="font-mono font-bold">{hostname}</span> untuk konfirmasi
            </Label>
            <Input id="terminate-confirm" name="confirmHostname" autoComplete="off" className="font-mono" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <SubmitButton variant="destructive" pendingText="Menghapus…">
              Terminasi sekarang
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function AdminRevealPassword({ serviceId }: { serviceId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function reveal() {
    if (reason.trim().length < 5) {
      toastError("Alasan wajib diisi minimal 5 karakter.");
      return;
    }
    setPending(true);
    try {
      const result = await revealPasswordAction(serviceId, reason);
      if (result.ok) {
        setPassword(result.data?.password ?? "");
        toastSuccess(result.message);
      } else {
        toastError(result.message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) { setPassword(null); setReason(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#D8E2DB] bg-white">
          <KeyRound className="size-4" /> Lihat password root
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Akses data sensitif</DialogTitle>
          <DialogDescription>
            Tindakan ini dicatat di audit log. Isi alasan akses sebelum menampilkan password.
          </DialogDescription>
        </DialogHeader>
        {password ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-[#BFE3CC] bg-[#F3F9F5] px-3 py-2">
              <code className="flex-1 font-mono text-sm break-all">{password}</code>
              <CopyButton value={password} label="" size="icon-sm" />
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={() => setPassword(null)}>
              <Eye className="size-4" /> Sembunyikan
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reveal-reason">Alasan akses</Label>
              <Input
                id="reveal-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Contoh: investigasi tiket TKT-123"
              />
            </div>
            <Button type="button" onClick={reveal} disabled={pending} className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
              {pending ? "Membuka…" : "Tampilkan password"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
