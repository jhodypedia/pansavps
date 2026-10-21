"use client";

import { useState } from "react";
import { Ban, RotateCcw, Undo2 } from "lucide-react";
import {
  cancelOrderAction,
  requestRefundAction,
  retryProvisioningAction,
} from "@/server/actions/orders";
import { ActionButton } from "@/components/dashboard/action-button";
import { ActionForm } from "@/components/dashboard/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function OrderActions({
  orderId,
  status,
  orderNumber,
  hasRefund = false,
}: {
  orderId: string;
  status: string;
  orderNumber: string;
  hasRefund?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const canCancel = status === "pending_payment";
  const canRetry = status === "failed" && !hasRefund;
  const canRefund = ["failed", "cancelled", "expired"].includes(status) && !hasRefund;

  return (
    <div className="flex flex-wrap gap-2">
      {canCancel ? (
        <ActionButton
          action={() => cancelOrderAction(orderId)}
          confirm={`Batalkan pesanan ${orderNumber}? Invoice terkait juga akan dibatalkan.`}
          variant="outline"
          className="border-[#FECACA] bg-white text-[#B91C1C] hover:bg-[#FEE2E2]"
        >
          <Ban className="size-3.5" /> Batalkan pesanan
        </ActionButton>
      ) : null}
      {canRetry ? (
        <ActionButton
          action={() => retryProvisioningAction(orderId)}
          variant="default"
          className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
        >
          <RotateCcw className="size-3.5" /> Coba provisioning lagi
        </ActionButton>
      ) : null}
      {canRefund ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-[#D8E2DB] bg-white">
              <Undo2 className="size-4" /> Ajukan refund
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ajukan refund</DialogTitle>
              <DialogDescription>
                Dana refund dikembalikan ke saldo akun setelah ditinjau tim billing. Ceritakan
                kendala yang kamu alami.
              </DialogDescription>
            </DialogHeader>
            <ActionForm
              action={async (_prev, formData) => {
                const reason = String(formData.get("reason") ?? "");
                return requestRefundAction(orderId, reason);
              }}
              onSuccess={() => setOpen(false)}
            >
              <div className="space-y-2">
                <Label htmlFor="refund-reason">Alasan refund</Label>
                <Textarea
                  id="refund-reason"
                  name="reason"
                  rows={4}
                  minLength={10}
                  required
                  placeholder="Contoh: provisioning gagal berulang dan saya ingin dana dikembalikan ke saldo."
                />
                <p className="text-xs text-[#8A9A90]">Minimal 10 karakter.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <SubmitButton pendingText="Mengirim…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                  Kirim permintaan
                </SubmitButton>
              </DialogFooter>
            </ActionForm>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
