"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { PromoCode } from "@/lib/db/schema";
import { deletePromoAction, savePromoAction, togglePromoAction } from "@/server/actions/admin";
import { ActionForm } from "@/components/dashboard/action-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function toLocalInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function PromoEditor({ promo }: { promo?: PromoCode }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"percent" | "fixed">(promo?.type ?? "percent");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {promo ? (
          <Button variant="outline" size="sm" className="border-[#D8E2DB] bg-white">
            <Pencil className="size-3.5" /> Edit
          </Button>
        ) : (
          <Button className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Plus className="size-4" /> Buat promo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{promo ? `Edit ${promo.code}` : "Buat kode promo"}</DialogTitle>
          <DialogDescription>
            Diskon dihitung dari subtotal paket, sebelum biaya setup.
          </DialogDescription>
        </DialogHeader>

        <ActionForm action={savePromoAction} inlineError onSuccess={() => setOpen(false)}>
          {promo ? <input type="hidden" name="id" value={promo.id} /> : null}
          <input type="hidden" name="type" value={type} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`code-${promo?.id ?? "new"}`}>Kode</Label>
              <Input
                id={`code-${promo?.id ?? "new"}`}
                name="code"
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_-]+"
                defaultValue={promo?.code ?? ""}
                placeholder="HEMAT10"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis diskon</Label>
              <Select value={type} onValueChange={(value) => setType(value as "percent" | "fixed")}>
                <SelectTrigger className="border-[#D8E2DB] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Persen (%)</SelectItem>
                  <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`value-${promo?.id ?? "new"}`}>{type === "percent" ? "Nilai (%)" : "Nilai (Rp)"}</Label>
              <Input
                id={`value-${promo?.id ?? "new"}`}
                name="value"
                type="number"
                min={1}
                max={type === "percent" ? 100 : undefined}
                required
                defaultValue={promo?.value ?? ""}
                placeholder={type === "percent" ? "10" : "50000"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`max-${promo?.id ?? "new"}`}>Maks. diskon (Rp)</Label>
              <Input
                id={`max-${promo?.id ?? "new"}`}
                name="maxDiscount"
                type="number"
                min={0}
                step={1000}
                defaultValue={promo?.maxDiscount ?? ""}
                placeholder="Opsional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`min-${promo?.id ?? "new"}`}>Min. transaksi (Rp)</Label>
              <Input
                id={`min-${promo?.id ?? "new"}`}
                name="minAmount"
                type="number"
                min={0}
                step={1000}
                defaultValue={promo?.minAmount ?? 0}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`starts-${promo?.id ?? "new"}`}>Mulai</Label>
              <Input
                id={`starts-${promo?.id ?? "new"}`}
                name="startsAt"
                type="datetime-local"
                defaultValue={toLocalInput(promo?.startsAt)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`ends-${promo?.id ?? "new"}`}>Berakhir</Label>
              <Input
                id={`ends-${promo?.id ?? "new"}`}
                name="endsAt"
                type="datetime-local"
                defaultValue={toLocalInput(promo?.endsAt)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`quota-${promo?.id ?? "new"}`}>Kuota pemakaian</Label>
            <Input
              id={`quota-${promo?.id ?? "new"}`}
              name="quota"
              type="number"
              min={0}
              defaultValue={promo?.quota ?? ""}
              placeholder="Kosongkan untuk tanpa batas"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#101613]">
            <input type="checkbox" name="isActive" value="true" defaultChecked={promo?.isActive ?? true} className="accent-[#0B3D2E]" />
            Promo aktif
          </label>

          <div className="flex justify-end gap-2 border-t border-[#EDF1EE] pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#D8E2DB] bg-white">
              Batal
            </Button>
            <SubmitButton pendingText="Menyimpan…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              {promo ? "Simpan perubahan" : "Buat promo"}
            </SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function PromoRowActions({
  promoId,
  active,
  used,
}: {
  promoId: number;
  active: boolean;
  used: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton action={() => togglePromoAction(promoId)} className="border-[#D8E2DB] bg-white">
        {active ? "Nonaktifkan" : "Aktifkan"}
      </ActionButton>
      <ActionButton
        action={() => deletePromoAction(promoId)}
        variant="ghost"
        className="text-[#991B1B] hover:bg-[#FEF2F2]"
        confirm={
          used > 0
            ? "Promo sudah pernah dipakai. Promo akan dinonaktifkan, bukan dihapus. Lanjutkan?"
            : "Hapus kode promo ini?"
        }
      >
        Hapus
      </ActionButton>
    </div>
  );
}
