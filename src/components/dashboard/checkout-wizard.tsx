"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Tag,
  Wallet,
  X,
} from "lucide-react";
import type { BillingCycle } from "@/lib/db/schema";
import { createOrderAction, validatePromoAction } from "@/server/actions/orders";
import { ActionForm } from "@/components/dashboard/action-form";
import { TripayChannelPicker } from "@/components/dashboard/tripay-channels";

import type { TripayChannel } from "@/lib/payments/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestedWeeklyPrice } from "@/lib/pricing";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

type PlanView = {
  id: number;
  name: string;
  description: string;
  vcpus: number;
  ramMb: number;
  diskGb: number;
  transferTb: number;
  priceMonthly: number;
  priceWeekly: number | null;
  promoPriceMonthly: number | null;
  priceQuarterly: number | null;
  priceYearly: number | null;
  setupFee: number;
  allowRegionSlugs: string[];
  isFeatured: boolean;
};

type RegionView = { slug: string; name: string; country: string; pingMs: number | null };
type ImageView = { slug: string; name: string; distribution: string; version: string };
type Provider = { id: string; label: string; description: string };
type KeyView = { id: string; name: string; fingerprint: string };

const cycles: { key: BillingCycle; label: string; hint: string }[] = [
  { key: "weekly", label: "Mingguan", hint: "Aktif 7 hari, pengingat H-1" },
  { key: "monthly", label: "Bulanan", hint: "Fleksibel, bayar per bulan" },
  { key: "quarterly", label: "3 Bulan", hint: "Hemat dibanding bulanan" },
  { key: "yearly", label: "Tahunan", hint: "Harga terbaik" },
];

function idr(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\u00a0/g, " ");
}

function cyclePrice(plan: PlanView, cycle: BillingCycle) {
  if (cycle === "weekly") {
    return plan.priceWeekly && plan.priceWeekly > 0
      ? plan.priceWeekly
      : suggestedWeeklyPrice(plan.priceMonthly);
  }
  if (cycle === "monthly") {
    return plan.promoPriceMonthly && plan.promoPriceMonthly > 0
      ? plan.promoPriceMonthly
      : plan.priceMonthly;
  }
  if (cycle === "quarterly") return plan.priceQuarterly ?? plan.priceMonthly * 3;
  return plan.priceYearly ?? plan.priceMonthly * 12;
}

function cycleNormalPrice(plan: PlanView, cycle: BillingCycle) {
  if (cycle === "weekly") return cyclePrice(plan, "weekly");
  if (cycle === "monthly") return plan.priceMonthly;
  if (cycle === "quarterly") return plan.priceQuarterly ?? plan.priceMonthly * 3;
  return plan.priceYearly ?? plan.priceMonthly * 12;
}

function randomHostname() {
  const words = ["nusa", "pansa", "biru", "hijau", "cepat", "awan", "data", "karya"];
  const word = words[Math.floor(Math.random() * words.length)];
  return `${word}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CheckoutWizard({
  plans,
  regions,
  images,
  sshKeys,
  providers,
  tripayChannels,
  balance,
  initialPlanId,
}: {
  plans: PlanView[];
  regions: RegionView[];
  images: ImageView[];
  sshKeys: KeyView[];
  providers: Provider[];
  tripayChannels: TripayChannel[];
  balance: number;
  initialPlanId?: number;
}) {
  const [step, setStep] = useState(1);
  const [planId, setPlanId] = useState<number>(initialPlanId ?? plans[0]?.id ?? 0);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [region, setRegion] = useState("");
  const [os, setOs] = useState(images[0]?.slug ?? "");
  const [hostname, setHostname] = useState("");
  const [newSshKeyName, setNewSshKeyName] = useState("");
  const [newSshKeyPublic, setNewSshKeyPublic] = useState("");
  const initialPaymentMethod =
    providers.some((provider) => provider.id === "tripay") && tripayChannels.length > 0
      ? "tripay"
      : (providers.find((provider) => provider.id === "manual")?.id ?? "balance");
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [paymentChannel, setPaymentChannel] = useState(tripayChannels[0]?.code ?? "");
  const [sshMode, setSshMode] = useState("password");
  const [sshKeyId, setSshKeyId] = useState(sshKeys[0]?.id ?? "");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, startPromo] = useTransition();
  const checkoutTopRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef(step);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    checkoutTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const plan = plans.find((item) => item.id === planId) ?? plans[0];
  const availableRegions = useMemo(
    () => (plan ? regions.filter((item) => plan.allowRegionSlugs.includes(item.slug)) : regions),
    [plan, regions],
  );
  const currentRegion = availableRegions.some((item) => item.slug === region)
    ? region
    : (availableRegions[0]?.slug ?? "");

  const subtotal = plan ? cyclePrice(plan, cycle) : 0;
  const discount = promo?.discount ?? 0;
  const total = Math.max(0, subtotal + (plan?.setupFee ?? 0) - discount);
  const monthlyEquivalent =
    cycle === "weekly"
      ? Math.round(subtotal * (30 / 7))
      : Math.round(subtotal / (cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : 12));
  const canAfford = total <= balance;
  const paymentMethodLabel =
    paymentMethod === "balance"
      ? "Saldo akun"
      : providers.find((provider) => provider.id === paymentMethod)?.label ?? "Pembayaran";

  function applyPromo() {
    if (!plan) return;
    if (!promoInput.trim()) {
      setPromoError("Masukkan kode promo terlebih dahulu.");
      return;
    }
    startPromo(async () => {
      const result = await validatePromoAction({ code: promoInput.trim(), planId: plan.id, cycle });
      if (result.ok && result.data) {
        setPromo({ code: promoInput.trim().toUpperCase(), discount: result.data.discount });
        setPromoError(null);
        toastSuccess(result.message);
      } else {
        setPromo(null);
        setPromoError(result.message);
        toastError(result.message);
      }
    });
  }

  function next() {
    if (step === 1 && !plan) return toastError("Pilih paket terlebih dahulu.");
    if (step === 2 && !currentRegion) return toastError("Pilih region.");
    if (step === 2 && !os) return toastError("Pilih sistem operasi.");
    if (step === 3) {
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(hostname) || hostname.length < 3) {
        return toastError("Hostname minimal 3 karakter: huruf kecil, angka, dan strip.");
      }
      if (sshMode === "existing" && !sshKeyId) return toastError("Pilih SSH key.");
      if (sshMode === "new") {
        if (newSshKeyName.trim().length < 2) return toastError("Nama SSH key minimal 2 karakter.");
        if (!newSshKeyPublic.trim()) return toastError("Tempel public key SSH terlebih dahulu.");
        if (!/^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256)\s+[A-Za-z0-9+/=]+/.test(newSshKeyPublic.trim())) {
          return toastError("Format public key tidak valid (ssh-rsa / ssh-ed25519).");
        }
      }
    }
    setStep((value) => Math.min(4, value + 1));
  }

  function confirmOrder() {
    if (!termsAccepted) {
      toastError("Centang persetujuan Syarat & Ketentuan terlebih dahulu.");
      return;
    }
    setConfirmOpen(false);
    submitRef.current?.click();
  }

  if (!plan) {
    return (
      <div className="rounded-2xl border border-[#E3E8E4] bg-white p-10 text-center">
        <p className="text-sm text-[#5B6B60]">Belum ada paket aktif. Hubungi admin.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
      <div className="space-y-6">
        <div ref={checkoutTopRef} className="scroll-mt-24 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#8A9A90] uppercase">Checkout</p>
            <p className="text-[11px] font-semibold text-[#0B3D2E]">Langkah {step} dari 4</p>
          </div>
          <ol className="flex items-center gap-2" aria-label="Langkah checkout">
            {["Paket", "Region & OS", "Server", "Pembayaran"].map((label, index) => {
              const number = index + 1;
              const done = step > number;
              const active = step === number;
              return (
                <li key={label} className="flex flex-1 items-center gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                        done
                          ? "bg-[#16A34A] text-white"
                          : active
                            ? "bg-[#0B3D2E] text-white ring-4 ring-[#0B3D2E]/10"
                            : "bg-[#F1F3F2] text-[#8A9A90]",
                      )}
                      aria-current={active ? "step" : undefined}
                    >
                      {done ? <Check className="size-3.5" /> : number}
                    </span>
                    <span
                      className={cn(
                        "hidden truncate text-xs font-semibold sm:block",
                        active ? "text-[#101613]" : "text-[#8A9A90]",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {index < 3 ? (
                    <span
                      className={cn(
                        "h-px flex-1 transition-colors duration-300",
                        done ? "bg-[#BFE3CC]" : "bg-[#E3E8E4]",
                      )}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#E8EEEA]">
            <div
              className="h-full rounded-full bg-[#0B3D2E] transition-all duration-500 ease-out"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        <ActionForm action={createOrderAction} inlineError>
          <div className="overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white shadow-[0_1px_2px_rgba(16,22,19,0.04)]">
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="billingCycle" value={cycle} />
            <input type="hidden" name="regionSlug" value={currentRegion} />
            <input type="hidden" name="osSlug" value={os} />
            <input type="hidden" name="hostname" value={hostname} />
            <input type="hidden" name="paymentMethod" value={paymentMethod} />
            <input type="hidden" name="paymentChannel" value={paymentChannel} />
            <input type="hidden" name="sshMode" value={sshMode} />
            <input type="hidden" name="sshKeyId" value={sshMode === "existing" ? sshKeyId : ""} />
            <input type="hidden" name="newSshKeyName" value={newSshKeyName} />
            <input type="hidden" name="newSshKeyPublic" value={newSshKeyPublic} />
            <input type="hidden" name="promoCode" value={promo?.code ?? ""} />
            <button ref={submitRef} type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />

            <div key={step} className="checkout-step p-4 sm:p-6">
          {step === 1 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#101613]">Pilih paket</h2>
                <p className="text-sm text-[#5B6B60]">Harga sudah termasuk resource penuh dan akses root.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((item) => {
                  const selected = plan.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setPlanId(item.id);
                        setPromo(null);
                        setPromoError(null);
                      }}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all",
                        selected
                          ? "border-[#0B3D2E] bg-[#F3F9F5] ring-2 ring-[#0B3D2E]/10"
                          : "border-[#E3E8E4] bg-white hover:border-[#BFE3CC]",
                      )}
                      aria-pressed={selected}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-[#101613]">{item.name}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-[#5B6B60]">{item.description}</p>
                        </div>
                        {selected ? (
                          <CheckCircle2 className="size-5 shrink-0 text-[#0B3D2E]" />
                        ) : null}
                      </div>
                      <p className="mt-3 text-lg font-bold text-[#0B3D2E]">
                        {idr(item.promoPriceMonthly ?? item.priceMonthly)}
                        <span className="text-xs font-normal text-[#8A9A90]">/bulan</span>
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#5B6B60]">
                        <li className="inline-flex items-center gap-1"><Cpu className="size-3" /> {item.vcpus} vCPU</li>
                        <li className="inline-flex items-center gap-1"><Database className="size-3" /> {item.ramMb / 1024} GB</li>
                        <li className="inline-flex items-center gap-1"><HardDrive className="size-3" /> {item.diskGb} GB</li>
                        <li className="inline-flex items-center gap-1"><Globe2 className="size-3" /> {item.transferTb} TB</li>
                      </ul>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-bold text-[#101613]">Siklus penagihan</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {cycles.map((item) => {
                    const selected = cycle === item.key;
                    const price = cyclePrice(plan, item.key);
                    const normal = cycleNormalPrice(plan, item.key);
                    const save = normal > price ? Math.round(((normal - price) / normal) * 100) : 0;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setCycle(item.key);
                          setPromo(null);
                          setPromoError(null);
                        }}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-colors",
                          selected
                            ? "border-[#0B3D2E] bg-[#0B3D2E] text-white"
                            : "border-[#E3E8E4] bg-white hover:border-[#BFE3CC]",
                        )}
                        aria-pressed={selected}
                      >
                        <p className="text-sm font-bold">{item.label}</p>
                        <p className={cn("mt-1 text-sm font-semibold", selected ? "text-white" : "text-[#0B3D2E]")}>
                          {idr(price)}
                        </p>
                        <p className={cn("mt-0.5 text-[11px]", selected ? "text-white/60" : "text-[#8A9A90]")}>
                          {save > 0 ? `Hemat ${save}% · ` : ""}{item.hint}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {cycle === "weekly" ? (
                  <div className="mt-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs leading-relaxed text-[#92400E]">
                    <strong>VPS mingguan aktif 7 hari.</strong> Kamu akan mendapat pengingat H-1 untuk
                    memperpanjang sebelum masa aktif berakhir (WIB).
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#101613]">Region & sistem operasi</h2>
                <p className="text-sm text-[#5B6B60]">Pilih lokasi server dan OS awal.</p>
              </div>
              <div>
                <Label className="mb-2 block">Region</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {availableRegions.map((item) => {
                    const selected = currentRegion === item.slug;
                    return (
                      <button
                        key={item.slug}
                        type="button"
                        onClick={() => setRegion(item.slug)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left",
                          selected
                            ? "border-[#0B3D2E] bg-[#F3F9F5]"
                            : "border-[#E3E8E4] bg-white hover:border-[#BFE3CC]",
                        )}
                        aria-pressed={selected}
                      >
                        <span className="flex items-center gap-2.5">
                          <Globe2 className={cn("size-4", selected ? "text-[#0B3D2E]" : "text-[#8A9A90]")} />
                          <span>
                            <span className="block text-sm font-semibold text-[#101613]">{item.name}</span>
                            <span className="block text-xs text-[#8A9A90]">
                              {item.country} · {item.slug}
                              {item.pingMs ? ` · ~${item.pingMs} ms` : ""}
                            </span>
                          </span>
                        </span>
                        {selected ? <CheckCircle2 className="size-4 text-[#0B3D2E]" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Sistem operasi</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {images.map((item) => {
                    const selected = os === item.slug;
                    return (
                      <button
                        key={item.slug}
                        type="button"
                        onClick={() => setOs(item.slug)}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-sm",
                          selected
                            ? "border-[#0B3D2E] bg-[#F3F9F5] font-semibold text-[#101613]"
                            : "border-[#E3E8E4] bg-white text-[#5B6B60] hover:border-[#BFE3CC]",
                        )}
                        aria-pressed={selected}
                      >
                        {item.name}
                        {selected ? <Check className="size-4 text-[#0B3D2E]" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#101613]">Konfigurasi server</h2>
                <p className="text-sm text-[#5B6B60]">Tentukan nama server dan cara akses awal.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hostname">Hostname</Label>
                <div className="flex gap-2">
                  <Input
                    id="hostname"
                    value={hostname}
                    onChange={(event) => setHostname(event.target.value.toLowerCase())}
                    placeholder="server-saya"
                    pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                    minLength={3}
                    maxLength={63}
                    required
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 border-[#D8E2DB] bg-white"
                    onClick={() => setHostname(randomHostname())}
                  >
                    <RefreshCw className="size-4" /> Acak
                  </Button>
                </div>
                <p className="text-xs text-[#8A9A90]">
                  Huruf kecil, angka, dan strip. Contoh: <code>web-prod-01</code>.
                </p>
              </div>

              <div>
                <Label className="mb-2 block">Akses awal</Label>
                <div className="space-y-2">
                  {[
                    { key: "password", title: "Password root otomatis", description: "Password dibuat sistem dan dikirim ke email/WhatsApp." },
                    ...(sshKeys.length > 0
                      ? [{ key: "existing", title: "SSH key tersimpan", description: "Gunakan salah satu SSH key di akunmu." }]
                      : []),
                    { key: "new", title: "SSH key baru", description: "Tempel public key dan simpan untuk pemesanan berikutnya." },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSshMode(option.key)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left",
                        sshMode === option.key
                          ? "border-[#0B3D2E] bg-[#F3F9F5]"
                          : "border-[#E3E8E4] bg-white hover:border-[#BFE3CC]",
                      )}
                      aria-pressed={sshMode === option.key}
                    >
                      <span className={cn("mt-0.5", sshMode === option.key ? "text-[#0B3D2E]" : "text-[#8A9A90]")}>
                        {option.key === "password" ? <Lock className="size-4" /> : <KeyRound className="size-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[#101613]">{option.title}</span>
                        <span className="block text-xs text-[#5B6B60]">{option.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {sshMode === "existing" ? (
                <div className="space-y-2">
                  <Label>Pilih SSH key</Label>
                  <select
                    value={sshKeyId}
                    onChange={(event) => setSshKeyId(event.target.value)}
                    className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm"
                  >
                    {sshKeys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.name} — {key.fingerprint}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {sshMode === "new" ? (
                <div className="space-y-3 rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-4">
                  <div className="space-y-2">
                    <Label htmlFor="newSshKeyName">Nama key</Label>
                    <Input
                      id="newSshKeyName"
                      value={newSshKeyName}
                      onChange={(event) => setNewSshKeyName(event.target.value)}
                      placeholder="laptop-kantor"
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newSshKeyPublic">Public key</Label>
                    <textarea
                      id="newSshKeyPublic"
                      value={newSshKeyPublic}
                      onChange={(event) => setNewSshKeyPublic(event.target.value)}
                      rows={3}
                      placeholder="ssh-ed25519 AAAAC3Nza..."
                      className="w-full rounded-md border border-[#D8E2DB] bg-white px-3 py-2 font-mono text-xs"
                    />
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {step === 4 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#101613]">Pembayaran</h2>
                <p className="text-sm text-[#5B6B60]">Pilih metode dan terapkan kode promo bila ada.</p>
              </div>

              <div>
                <Label className="mb-2 block">Metode pembayaran</Label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("balance")}
                    disabled={!canAfford}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-50",
                      paymentMethod === "balance"
                        ? "border-[#0B3D2E] bg-[#F3F9F5]"
                        : "border-[#E3E8E4] bg-white hover:border-[#BFE3CC]",
                    )}
                    aria-pressed={paymentMethod === "balance"}
                  >
                    <Wallet className="size-4 text-[#0B3D2E]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#101613]">Saldo akun (opsional)</span>
                      <span className="block text-xs text-[#5B6B60]">
                        Tersedia {idr(balance)}
                        {!canAfford ? " · tidak cukup, pilih pembayaran langsung" : ""}
                      </span>
                    </span>
                    {paymentMethod === "balance" ? <CheckCircle2 className="size-4 text-[#0B3D2E]" /> : null}
                  </button>
                  {providers.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(provider.id);
                        if (provider.id === "tripay" && !paymentChannel) {
                          setPaymentChannel(tripayChannels[0]?.code ?? "");
                        }
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left",
                        paymentMethod === provider.id
                          ? "border-[#0B3D2E] bg-[#F3F9F5]"
                          : "border-[#E3E8E4] bg-white hover:border-[#BFE3CC]",
                      )}
                      aria-pressed={paymentMethod === provider.id}
                    >
                      <ShieldCheck className="size-4 text-[#0B3D2E]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[#101613]">{provider.label}</span>
                        <span className="block text-xs text-[#5B6B60]">
                          {provider.id === "tripay"
                            ? "Pilih channel pembayaran di bawah (QRIS, VA, Alfamart, dll)."
                            : provider.description}
                        </span>
                      </span>
                      {paymentMethod === provider.id ? <CheckCircle2 className="size-4 text-[#0B3D2E]" /> : null}
                    </button>
                  ))}
                </div>
                {paymentMethod === "tripay" ? (
                  <div className="mt-3 rounded-xl border border-[#CFE6D8] bg-[#F9FCFA] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold tracking-wide text-[#0B3D2E] uppercase">
                        Channel pembayaran
                      </p>
                      <span className="text-[10px] font-medium text-[#8A9A90]">Pilih salah satu</span>
                    </div>
                    <TripayChannelPicker
                      channels={tripayChannels}
                      value={paymentChannel}
                      onChange={setPaymentChannel}
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo">Kode promo (opsional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="promo"
                    value={promoInput}
                    onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                    placeholder="HEMAT10"
                    className="font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyPromo}
                    disabled={promoPending}
                    className="shrink-0 border-[#D8E2DB] bg-white"
                  >
                    {promoPending ? <Loader2 className="size-4 animate-spin" /> : <Tag className="size-4" />}
                    Terapkan
                  </Button>
                </div>
                {promo ? (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                    <CheckCircle2 className="size-3.5" /> {promo.code} aktif — hemat {idr(promo.discount)}
                    <button
                      type="button"
                      onClick={() => {
                        setPromo(null);
                        setPromoInput("");
                      }}
                      className="ml-1 text-[#8A9A90] hover:text-[#B91C1C]"
                      aria-label="Hapus promo"
                    >
                      <X className="size-3.5" />
                    </button>
                  </p>
                ) : null}
                {promoError ? <p className="text-xs text-[#B91C1C]">{promoError}</p> : null}
              </div>

              <div className="rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-4 text-xs leading-relaxed text-[#5B6B60]">
                Pastikan data server sudah benar. Konfirmasi persetujuan Syarat & Ketentuan akan
                diminta sebelum pesanan dibuat.
              </div>
            </section>
          ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#EDF1EE] bg-[#FBFCFB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((value) => Math.max(1, value - 1))}
                disabled={step === 1}
                className="h-11 w-full border-[#D8E2DB] bg-white sm:w-auto"
              >
                <ArrowLeft className="size-4" /> Sebelumnya
              </Button>
              {step < 4 ? (
                <Button
                  type="button"
                  onClick={next}
                  className="h-11 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38] sm:w-auto"
                >
                  Lanjut <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    setTermsAccepted(false);
                    setConfirmOpen(true);
                  }}
                  disabled={paymentMethod === "balance" && !canAfford}
                  className="h-11 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38] sm:w-auto"
                >
                  <Check className="size-4" /> Buat pesanan · {idr(total)}
                </Button>
              )}
            </div>
          </div>
        </ActionForm>

        <AlertDialog open={confirmOpen} onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setTermsAccepted(false);
        }}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi pesanan</AlertDialogTitle>
              <AlertDialogDescription>
                Pastikan paket, siklus, region, sistem operasi, dan metode pembayaran sudah benar. Pesanan
                yang sudah dibuat akan langsung diproses.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <div className="rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-4 text-xs leading-relaxed text-[#5B6B60]">
                <div className="flex items-center justify-between gap-3">
                  <span>Paket</span>
                  <span className="font-semibold text-[#101613]">{plan.name}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>Siklus</span>
                  <span className="font-semibold text-[#101613]">
                    {cycles.find((item) => item.key === cycle)?.label ?? cycle}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>Pembayaran</span>
                  <span className="font-semibold text-[#101613]">{paymentMethodLabel}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#EDF1EE] pt-2">
                  <span className="font-semibold text-[#101613]">Total</span>
                  <span className="font-display font-bold text-[#0B3D2E]">{idr(total)}</span>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-[#EDF1EE] bg-white p-3">
                <Checkbox
                  id="checkout-terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="checkout-terms" className="cursor-pointer text-xs font-semibold text-[#101613]">
                    Saya telah membaca dan menyetujui ketentuan berikut
                  </Label>
                  <p className="text-xs leading-relaxed text-[#5B6B60]">
                    <a href="/syarat-ketentuan" target="_blank" rel="noreferrer" className="font-semibold text-[#0B3D2E] underline">
                      Syarat & Ketentuan
                    </a>
                    {", "}
                    <a href="/kebijakan-refund" target="_blank" rel="noreferrer" className="font-semibold text-[#0B3D2E] underline">
                      Kebijakan Refund
                    </a>
                    {", dan "}
                    <a href="/kebijakan-privasi" target="_blank" rel="noreferrer" className="font-semibold text-[#0B3D2E] underline">
                      Kebijakan Privasi
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                disabled={!termsAccepted}
                onClick={confirmOrder}
                className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
              >
                Ya, buat pesanan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white">
          <div className="relative overflow-hidden border-b border-[#EDF1EE] bg-[#0B3D2E] px-5 py-4 text-white">
            <div className="pointer-events-none absolute -top-14 -right-10 size-40 rounded-full bg-[#16A34A]/25 blur-2xl" />
            <div className="relative">
              <p className="text-[10px] font-bold tracking-[0.14em] text-white/55 uppercase">Ringkasan pesanan</p>
              <p className="mt-1 font-display text-lg font-bold">{plan.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-white/80">
                <span className="rounded-full bg-white/10 px-2 py-0.5">{plan.vcpus} vCPU</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5">{plan.ramMb / 1024} GB RAM</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5">{plan.diskGb} GB SSD</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <SummaryRow label="Siklus" value={cycles.find((item) => item.key === cycle)?.label ?? cycle} />
            <SummaryRow label="Region" value={availableRegions.find((item) => item.slug === currentRegion)?.name ?? "—"} />
            <SummaryRow label="OS" value={images.find((item) => item.slug === os)?.name ?? "—"} />
            <SummaryRow label="Hostname" value={hostname || "Belum diisi"} mono />
            <SummaryRow label="Akses" value={sshMode === "password" ? "Password root" : sshMode === "existing" ? "SSH key" : "SSH key baru"} />
            <div className="border-t border-[#EDF1EE] pt-3">
              <SummaryRow label="Subtotal" value={idr(subtotal)} />
              {plan.setupFee > 0 ? <SummaryRow label="Setup" value={idr(plan.setupFee)} /> : null}
              {discount > 0 ? (
                <SummaryRow label={`Diskon ${promo?.code ?? ""}`} value={`−${idr(discount)}`} positive />
              ) : null}
              <SummaryRow label={`Ekuivalen/bulan`} value={idr(monthlyEquivalent)} muted />
            </div>
            {cycle === "weekly" ? (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E]">
                VPS mingguan aktif 7 hari. Pengingat H-1 dikirim melalui notifikasi, email, dan WhatsApp.
              </div>
            ) : null}
            <div className="flex items-end justify-between border-t border-[#EDF1EE] pt-3">
              <span className="text-sm font-semibold text-[#101613]">Total</span>
              <span className="font-display text-xl font-bold text-[#0B3D2E]">{idr(total)}</span>
            </div>
            <div className="rounded-lg bg-[#F3F9F5] p-3 text-xs text-[#5B6B60]">
              {paymentMethod === "balance"
                ? canAfford
                  ? "Saldo cukup. Server diproses otomatis setelah pesanan dibuat."
                  : "Saldo belum cukup. Pilih pembayaran langsung (online/transfer) tanpa top up saldo."
                : "Invoice akan dibuat dan kamu diarahkan ke halaman pembayaran."}
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex items-center gap-2 rounded-xl border border-[#E3E8E4] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#5B6B60]">
            <ShieldCheck className="size-4 shrink-0 text-[#16A34A]" /> Pembayaran aman & terverifikasi
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#E3E8E4] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#5B6B60]">
            <RefreshCw className="size-4 shrink-0 text-[#16A34A]" /> Aktivasi server otomatis
          </div>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono,
  positive,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  positive?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-[#5B6B60]", muted && "text-xs")}>{label}</span>
      <span
        className={cn(
          "max-w-[60%] truncate text-right font-semibold text-[#101613]",
          mono && "font-mono text-xs",
          positive && "text-[#15803D]",
          muted && "text-xs font-normal text-[#8A9A90]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
