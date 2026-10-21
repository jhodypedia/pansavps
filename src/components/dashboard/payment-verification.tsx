"use client";

import { useState } from "react";
import { Check, ExternalLink, FileText, X } from "lucide-react";
import { verifyManualPaymentAction } from "@/server/actions/admin";
import { ActionForm } from "@/components/dashboard/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
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

export function ApprovePaymentButton({ paymentId }: { paymentId: string }) {
  return (
    <ActionForm action={verifyManualPaymentAction} className="inline-flex">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="decision" value="approve" />
      <SubmitButton
        size="sm"
        pendingText="Memverifikasi…"
        className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
      >
        <Check className="size-3.5" /> Setujui
      </SubmitButton>
    </ActionForm>
  );
}

export function RejectPaymentDialog({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]">
          <X className="size-3.5" /> Tolak
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tolak pembayaran</DialogTitle>
          <DialogDescription>
            Tulis alasan yang jelas. Alasan akan ditampilkan ke pengguna pada halaman invoice.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={verifyManualPaymentAction} onSuccess={() => setOpen(false)}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <input type="hidden" name="decision" value="reject" />
          <div className="space-y-2">
            <Label htmlFor={`reason-${paymentId}`}>Alasan penolakan</Label>
            <Input id={`reason-${paymentId}`} name="reason" required minLength={3} placeholder="Nominal tidak sesuai / bukti tidak valid" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <SubmitButton variant="destructive" pendingText="Menolak…">
              Tolak pembayaran
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function ViewProofButton({ paymentId }: { paymentId: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="border-[#D8E2DB] bg-white">
      <a href={`/api/payments/${paymentId}/proof`} target="_blank" rel="noreferrer">
        <FileText className="size-3.5" /> Bukti <ExternalLink className="size-3" />
      </a>
    </Button>
  );
}
