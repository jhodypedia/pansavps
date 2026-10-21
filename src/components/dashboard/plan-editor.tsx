"use client";

import { useMemo, useState } from "react";
import { Calculator, Pencil, Plus, Sparkles } from "lucide-react";
import type { Plan } from "@/lib/db/schema";
import { savePlanAction, suggestPlanPriceAction, togglePlanAction, deletePlanAction } from "@/server/actions/admin";
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
import { Textarea } from "@/components/ui/textarea";
import { formatIDR } from "@/lib/format";
import { priceFromMarkup, suggestedWeeklyPrice } from "@/lib/pricing";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

type RegionOption = { slug: string; name: string };

export function PlanEditor({
  plan,
  regions,
  usdRate,
  markupPercent,
}: {
  plan?: Plan;
  regions: RegionOption[];
  usdRate: number;
  markupPercent: number;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(plan?.priceMonthly ?? ""));
  const [cost, setCost] = useState(String(plan?.costMonthlyUsd ?? ""));
  const [name, setName] = useState(plan?.name ?? "");
  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [suggesting, setSuggesting] = useState(false);
  const [pricingAuto, setPricingAuto] = useState(plan ? plan.pricingMode === "auto" : true);

  const autoPrice = useMemo(
    () => priceFromMarkup(Number(cost) || 0, usdRate, markupPercent),
    [cost, usdRate, markupPercent],
  );
  const sellingPrice = pricingAuto ? autoPrice : Number(price) || 0;

  const margin = useMemo(() => {
    const modal = Math.round((Number(cost) || 0) * usdRate);
    const selling = sellingPrice;
    const diff = selling - modal;
    const percent = selling > 0 ? (diff / selling) * 100 : 0;
    return { modal, diff, percent, belowCost: diff < 0 };
  }, [cost, sellingPrice, usdRate]);

  async function suggest() {
    setSuggesting(true);
    const result = await suggestPlanPriceAction(Number(cost) || 0);
    setSuggesting(false);
    if (!result.ok) {
      toastError(result.message);
      return;
    }
    if (result.data?.price !== undefined) {
      setPrice(String(result.data.price));
      toastSuccess(`Harga saran: ${formatIDR(result.data.price)}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {plan ? (
          <Button variant="outline" size="sm" className="border-[#D8E2DB] bg-white">
            <Pencil className="size-3.5" /> Edit
          </Button>
        ) : (
          <Button className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Plus className="size-4" /> Paket baru
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : "Buat paket baru"}</DialogTitle>
          <DialogDescription>
            Harga dan spesifikasi tersimpan di database dan langsung tampil di halaman publik.
          </DialogDescription>
        </DialogHeader>

        <ActionForm
          action={savePlanAction}
          inlineError
          onSuccess={() => setOpen(false)}
          className="space-y-5"
        >
          {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`name-${plan?.id ?? "new"}`}>Nama paket</Label>
              <Input
                id={`name-${plan?.id ?? "new"}`}
                name="name"
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!plan) {
                    setSlug(
                      event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, "")
                        .slice(0, 64),
                    );
                  }
                }}
                placeholder="VPS 4 GB"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`slug-${plan?.id ?? "new"}`}>Slug</Label>
              <Input
                id={`slug-${plan?.id ?? "new"}`}
                name="slug"
                required
                pattern="[a-z0-9-]+"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="vps-4gb"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`description-${plan?.id ?? "new"}`}>Deskripsi singkat</Label>
            <Textarea
              id={`description-${plan?.id ?? "new"}`}
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={plan?.description ?? ""}
              placeholder="Cocok untuk aplikasi produksi kecil dan staging."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor={`size-${plan?.id ?? "new"}`}>DO size slug</Label>
              <Input
                id={`size-${plan?.id ?? "new"}`}
                name="doSizeSlug"
                required
                defaultValue={plan?.doSizeSlug ?? ""}
                placeholder="s-2vcpu-4gb"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`vcpus-${plan?.id ?? "new"}`}>vCPU</Label>
              <Input id={`vcpus-${plan?.id ?? "new"}`} name="vcpus" type="number" min={1} max={64} required defaultValue={plan?.vcpus ?? 1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`ram-${plan?.id ?? "new"}`}>RAM (MB)</Label>
              <Input id={`ram-${plan?.id ?? "new"}`} name="ramMb" type="number" min={256} step={256} required defaultValue={plan?.ramMb ?? 1024} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`disk-${plan?.id ?? "new"}`}>Disk (GB)</Label>
              <Input id={`disk-${plan?.id ?? "new"}`} name="diskGb" type="number" min={5} required defaultValue={plan?.diskGb ?? 25} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor={`transfer-${plan?.id ?? "new"}`}>Transfer (TB)</Label>
              <Input id={`transfer-${plan?.id ?? "new"}`} name="transferTb" type="number" min={0} required defaultValue={plan?.transferTb ?? 1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`cost-${plan?.id ?? "new"}`}>Modal / bulan (USD)</Label>
              <Input
                id={`cost-${plan?.id ?? "new"}`}
                name="costMonthlyUsd"
                type="number"
                min={0}
                step="0.01"
                required
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`sort-${plan?.id ?? "new"}`}>Urutan</Label>
              <Input id={`sort-${plan?.id ?? "new"}`} name="sortOrder" type="number" min={0} max={9999} defaultValue={plan?.sortOrder ?? 0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`setup-${plan?.id ?? "new"}`}>Biaya setup (Rp)</Label>
              <Input id={`setup-${plan?.id ?? "new"}`} name="setupFee" type="number" min={0} step={1000} defaultValue={plan?.setupFee ?? 0} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor={`weekly-${plan?.id ?? "new"}`}>Harga mingguan (Rp)</Label>
              <Input
                id={`weekly-${plan?.id ?? "new"}`}
                name="priceWeekly"
                type="number"
                min={0}
                step={1000}
                defaultValue={plan?.priceWeekly ?? ""}
                placeholder={
                  sellingPrice > 0 ? `Otomatis: ${formatIDR(suggestedWeeklyPrice(sellingPrice))}` : "Otomatis"
                }
              />
              <p className="text-[11px] leading-snug text-[#8A9A90]">
                Aktif 7 hari lalu dihapus otomatis. Kosongkan untuk memakai harga otomatis.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`monthly-${plan?.id ?? "new"}`}>Harga bulanan (Rp)</Label>
              <Input
                id={`monthly-${plan?.id ?? "new"}`}
                name="priceMonthly"
                type="number"
                min={0}
                step={1000}
                required={!pricingAuto}
                disabled={pricingAuto}
                value={pricingAuto ? String(autoPrice) : price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`quarterly-${plan?.id ?? "new"}`}>Harga 3 bulan</Label>
              <Input id={`quarterly-${plan?.id ?? "new"}`} name="priceQuarterly" type="number" min={0} step={1000} defaultValue={plan?.priceQuarterly ?? ""} placeholder="Opsional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`yearly-${plan?.id ?? "new"}`}>Harga tahunan</Label>
              <Input id={`yearly-${plan?.id ?? "new"}`} name="priceYearly" type="number" min={0} step={1000} defaultValue={plan?.priceYearly ?? ""} placeholder="Opsional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`promo-${plan?.id ?? "new"}`}>Harga promo bulanan</Label>
              <Input id={`promo-${plan?.id ?? "new"}`} name="promoPriceMonthly" type="number" min={0} step={1000} defaultValue={plan?.promoPriceMonthly ?? ""} placeholder="Opsional" />
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-[#D8E2DB] bg-[#FBFCFB] p-3 text-sm text-[#101613]">
            <input
              type="checkbox"
              name="pricingAuto"
              checked={pricingAuto}
              onChange={(event) => {
                const next = event.target.checked;
                if (!next) setPrice(String(autoPrice));
                setPricingAuto(next);
              }}
              className="mt-0.5 accent-[#0B3D2E]"
            />
            <span>
              <span className="font-semibold">Harga otomatis</span>
              <span className="mt-0.5 block text-xs text-[#8A9A90]">
                Harga jual dihitung dari modal USD × kurs × markup. Matikan untuk memakai harga custom per produk.
              </span>
            </span>
          </label>

          <div
            className={cn(
              "rounded-xl border p-4",
              margin.belowCost ? "border-[#FECACA] bg-[#FEF2F2]" : "border-[#E3E8E4] bg-[#F7F8F7]",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <Calculator className="size-3.5" /> Analisis margin
                </p>
                <p className="mt-1 text-sm text-[#101613]">
                  Modal {formatIDR(margin.modal)} · Margin{" "}
                  <span className={margin.belowCost ? "font-bold text-[#991B1B]" : "font-bold text-[#0B3D2E]"}>
                    {formatIDR(margin.diff)} ({Math.round(margin.percent)}%)
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[#8A9A90]">
                  Kurs {formatIDR(usdRate)}/USD · markup default {markupPercent}% ·{" "}
                  {pricingAuto ? "harga otomatis" : "harga custom"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={suggest}
                disabled={suggesting || !cost}
                className="border-[#BFE3CC] bg-white text-[#0B3D2E]"
              >
                <Sparkles className="size-3.5" /> {suggesting ? "Menghitung…" : "Harga saran"}
              </Button>
            </div>
            {margin.belowCost ? (
              <label className="mt-3 flex items-start gap-2 text-xs font-medium text-[#991B1B]">
                <input type="checkbox" name="confirmBelowCost" value="true" className="mt-0.5 accent-[#991B1B]" />
                Harga jual di bawah modal. Saya tetap ingin menyimpan.
              </label>
            ) : (
              <input type="hidden" name="confirmBelowCost" value="false" />
            )}
          </div>

          <div className="space-y-2">
            <Label>Region yang tersedia</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {regions.map((region) => (
                <label
                  key={region.slug}
                  className="flex items-center gap-2 rounded-lg border border-[#E3E8E4] bg-white px-3 py-2 text-sm text-[#101613]"
                >
                  <input
                    type="checkbox"
                    name="allowRegionSlugs"
                    value={region.slug}
                    defaultChecked={
                      plan ? plan.allowRegionSlugs.includes(region.slug) : region.slug === "sgp1"
                    }
                    className="accent-[#0B3D2E]"
                  />
                  <span>
                    {region.name}
                    <span className="ml-1 font-mono text-[10px] text-[#8A9A90]">{region.slug}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-[#101613]">
              <input type="checkbox" name="isActive" value="true" defaultChecked={plan?.isActive ?? true} className="accent-[#0B3D2E]" />
              Aktif dan tampil di toko
            </label>
            <label className="flex items-center gap-2 text-sm text-[#101613]">
              <input type="checkbox" name="isFeatured" value="true" defaultChecked={plan?.isFeatured ?? false} className="accent-[#0B3D2E]" />
              Tandai unggulan
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#EDF1EE] pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#D8E2DB] bg-white">
              Batal
            </Button>
            <SubmitButton pendingText="Menyimpan…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              {plan ? "Simpan perubahan" : "Buat paket"}
            </SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function PlanRowActions({
  planId,
  active,
  used,
}: {
  planId: number;
  active: boolean;
  used: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton
        action={() => togglePlanAction(planId)}
        className="border-[#D8E2DB] bg-white"
      >
        {active ? "Nonaktifkan" : "Aktifkan"}
      </ActionButton>
      <ActionButton
        action={() => deletePlanAction(planId)}
        variant="ghost"
        className="text-[#991B1B] hover:bg-[#FEF2F2]"
        confirm={
          used
            ? "Paket ini sudah pernah dipakai. Paket akan dinonaktifkan, bukan dihapus. Lanjutkan?"
            : "Hapus paket ini? Tindakan tidak dapat dibatalkan."
        }
      >
        Hapus
      </ActionButton>
    </div>
  );
}
