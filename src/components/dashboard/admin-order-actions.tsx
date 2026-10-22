"use client";

import { useState } from "react";
import { Ban, RotateCcw, Undo2 } from "lucide-react";
import { adminOrderAction } from "@/server/actions/admin";
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

export function AdminOrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {["failed", "paid", "provisioning"].includes(status) ? (
        <ActionButton
          action={() => adminOrderAction(orderId, "retry")}
          className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
          variant="default"
        >
          <RotateCcw className="size-3.5" /> Coba buat ulang
        </ActionButton>
      ) : null}
      {["failed", "cancelled", "expired", "active"].includes(status) ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-[#D8E2DB] bg-white">
              <Undo2 className="size-4" /> Refund ke saldo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Refund pesanan</DialogTitle>
              <DialogDescription>
                Dana dikembalikan ke saldo pengguna. Jika VPS aktif, layanan akan dihentikan lebih dulu.
              </DialogDescription>
            </DialogHeader>
            <ActionForm
              action={async (_prev, formData) =>
                adminOrderAction(orderId, "refund", String(formData.get("note") ?? ""))
              }
              onSuccess={() => setOpen(false)}
            >
              <div className="space-y-2">
                <Label htmlFor="admin-refund-note">Catatan refund</Label>
                <Textarea id="admin-refund-note" name="note" rows={3} placeholder="Alasan refund…" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <SubmitButton pendingText="Memproses…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                  Proses refund
                </SubmitButton>
              </DialogFooter>
            </ActionForm>
          </DialogContent>
        </Dialog>
      ) : null}
      {["pending_payment", "failed", "paid"].includes(status) ? (
        <ActionButton
          action={() => adminOrderAction(orderId, "cancel")}
          variant="outline"
          className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]"
          confirm="Batalkan pesanan ini? Invoice yang belum dibayar juga akan dibatalkan."
        >
          <Ban className="size-3.5" /> Batalkan
        </ActionButton>
      ) : null}
    </div>
  );
}
