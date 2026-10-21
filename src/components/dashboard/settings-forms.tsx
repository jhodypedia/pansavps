"use client";

import {
  Bell,
  CreditCard,
  Globe,
  Mail,
  Megaphone,
  Save,
  Server,
  Tags,
} from "lucide-react";
import type { SettingsMap } from "@/lib/settings";
import type { DoAccountView } from "@/lib/do-account-types";
import type { SettingsSection } from "@/server/actions/admin";
import {
  saveEmailTemplateAction,
  saveSettingsAction,
  testEmailAction,
} from "@/server/actions/admin";
import { ActionForm } from "@/components/dashboard/action-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { DoAccountsManager } from "@/components/admin/do-accounts-manager";
import { SubmitButton } from "@/components/shared/submit-button";
import { SectionCard } from "@/components/dashboard/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EmailTemplateView = {
  key: string;
  title: string;
  subject: string;
  body: string;
  isCustom: boolean;
};

const adminEvents = [
  ["order_created", "Pesanan baru"],
  ["payment_paid", "Pembayaran diterima"],
  ["provisioning_failed", "Provisioning gagal"],
  ["ticket_created", "Tiket baru"],
  ["ticket_replied", "Balasan user"],
  ["topup_pending", "Top up menunggu"],
  ["service_terminated", "Layanan dihentikan"],
] as const;

const userEvents = [
  ["welcome", "Pendaftaran"],
  ["order_created", "Pesanan dibuat"],
  ["payment_paid", "Pembayaran diterima"],
  ["provisioning_done", "VPS aktif"],
  ["provisioning_failed", "Provisioning gagal"],
  ["invoice_reminder", "Pengingat jatuh tempo"],
  ["service_suspended", "Layanan ditangguhkan"],
  ["service_terminated", "Layanan dihentikan"],
  ["service_renewed", "Perpanjangan"],
  ["ticket_replied", "Balasan tiket"],
] as const;

function CheckField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-[#E3E8E4] bg-white p-3.5 text-sm">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="mt-0.5 accent-[#0B3D2E]" />
      <span>
        <span className="block font-medium text-[#101613]">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-relaxed text-[#8A9A90]">{hint}</span> : null}
      </span>
    </label>
  );
}

function SecretHint({ configured }: { configured: boolean }) {
  return (
    <p className="text-xs text-[#8A9A90]">
      {configured ? "Nilai tersimpan terenkripsi. Kosongkan jika tidak ingin mengubah." : "Belum diatur."}
    </p>
  );
}

function SaveButton({ children = "Simpan pengaturan" }: { children?: React.ReactNode }) {
  return (
    <SubmitButton pendingText="Menyimpan…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
      <Save className="size-4" /> {children}
    </SubmitButton>
  );
}

export function AdminSettingsTabs({
  settings,
  initialTab,
  emailTemplates,
  adminEventValues,
  userEventValues,
  secrets,
  appUrl,
  doAccounts,
}: {
  settings: SettingsMap;
  initialTab: string;
  emailTemplates: EmailTemplateView[];
  adminEventValues: string[];
  userEventValues: string[];
  secrets: Record<string, boolean>;
  appUrl: string;
  doAccounts: DoAccountView[];
}) {
  const submitFor = (section: SettingsSection) => saveSettingsAction.bind(null, section);

  return (
    <Tabs defaultValue={initialTab} className="gap-5">
      <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 rounded-xl border border-[#E3E8E4] bg-[#F7F8F7] p-1 xl:flex-nowrap">
        {[
          { value: "general", label: "Umum", icon: Globe },
          { value: "announcement", label: "Pengumuman", icon: Megaphone },
          { value: "digitalocean", label: "DigitalOcean", icon: Server },
          { value: "pricing", label: "Harga", icon: Tags },
          { value: "payment", label: "Pembayaran", icon: CreditCard },
          { value: "email", label: "Email", icon: Mail },
          { value: "notification", label: "Notifikasi", icon: Bell },
        ].map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="h-9! flex-none! gap-1.5 rounded-lg border border-transparent px-3 text-[#5B6B60] hover:bg-white/70 data-[state=active]:border-[#D8E2DB] data-[state=active]:bg-white data-[state=active]:text-[#0B3D2E]! data-[state=active]:shadow-sm"
          >
            <tab.icon className="size-3.5" /> {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="general">
        <SectionCard title="Identitas toko" description="Nama, tagline, dan kontak yang tampil di seluruh halaman publik.">
          <ActionForm action={submitFor("general")} inlineError>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="site_name">Nama toko</Label>
                <Input id="site_name" name="site_name" required defaultValue={settings.site_name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_tagline">Tagline</Label>
                <Input id="site_tagline" name="site_tagline" defaultValue={settings.site_tagline} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site_description">Deskripsi</Label>
              <Textarea id="site_description" name="site_description" rows={2} defaultValue={settings.site_description} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="site_logo_url">URL logo</Label>
                <Input id="site_logo_url" name="site_logo_url" defaultValue={settings.site_logo_url} placeholder="https://…/logo.png" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_favicon_url">URL favicon</Label>
                <Input id="site_favicon_url" name="site_favicon_url" defaultValue={settings.site_favicon_url} placeholder="https://…/favicon.ico" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="support_email">Email support</Label>
                <Input id="support_email" name="support_email" type="email" required defaultValue={settings.support_email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_whatsapp">WhatsApp support</Label>
                <Input id="support_whatsapp" name="support_whatsapp" required defaultValue={settings.support_whatsapp} placeholder="62812…" />
              </div>
            </div>
            <CheckField
              name="maintenance_mode"
              label="Mode maintenance"
              hint="Toko publik ditutup sementara. Dashboard pelanggan tetap dapat diakses."
              defaultChecked={settings.maintenance_mode === "true"}
            />

            <div className="space-y-4 rounded-xl border border-[#E3E8E4] bg-[#FBFCFB] p-4">
              <div>
                <p className="text-sm font-bold text-[#101613]">Cloudflare Turnstile</p>
                <p className="mt-1 text-xs leading-relaxed text-[#8A9A90]">
                  Lindungi halaman masuk, daftar, dan reset password dari bot. Buat widget di
                  dashboard Cloudflare, lalu tempel site key dan secret key di sini.
                </p>
                {settings.captcha_enabled === "true" &&
                (!settings.turnstile_site_key || !secrets.turnstile_secret_key) ? (
                  <p className="mt-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
                    Turnstile aktif tetapi kunci belum lengkap. Verifikasi akan dilewati sampai
                    site key dan secret key diisi.
                  </p>
                ) : null}
              </div>
              <CheckField
                name="captcha_enabled"
                label="Aktifkan Turnstile"
                hint="Jika aktif dan kunci lengkap, pengguna wajib menyelesaikan verifikasi."
                defaultChecked={settings.captcha_enabled === "true"}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="turnstile_site_key">Site key</Label>
                  <Input
                    id="turnstile_site_key"
                    name="turnstile_site_key"
                    defaultValue={settings.turnstile_site_key}
                    placeholder="0x4AAAAAAA…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="turnstile_secret_key">Secret key</Label>
                  <Input
                    id="turnstile_secret_key"
                    name="turnstile_secret_key"
                    type="password"
                    autoComplete="off"
                    placeholder={secrets.turnstile_secret_key ? "•••••••• (tersimpan)" : "0x4AAAAAAA…"}
                  />
                  <SecretHint configured={secrets.turnstile_secret_key} />
                </div>
              </div>
            </div>

            <SaveButton />
          </ActionForm>
        </SectionCard>
      </TabsContent>

      <TabsContent value="announcement">
        <SectionCard title="Pengumuman situs" description="Banner tipis di atas navbar publik.">
          <ActionForm action={submitFor("announcement")} inlineError>
            <CheckField
              name="announcement_active"
              label="Tampilkan pengumuman"
              hint="Hanya tampil jika teks pengumuman diisi."
              defaultChecked={settings.announcement_active === "true"}
            />
            <div className="space-y-2">
              <Label htmlFor="announcement_text">Teks</Label>
              <Textarea id="announcement_text" name="announcement_text" rows={3} maxLength={300} defaultValue={settings.announcement_text} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="announcement_link">Tautan (opsional)</Label>
                <Input id="announcement_link" name="announcement_link" defaultValue={settings.announcement_link} placeholder="/pricing" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement_tone">Warna</Label>
                <select
                  id="announcement_tone"
                  name="announcement_tone"
                  defaultValue={settings.announcement_tone}
                  className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm"
                >
                  <option value="info">Informasi</option>
                  <option value="warning">Peringatan</option>
                  <option value="success">Sukses</option>
                </select>
              </div>
            </div>
            <SaveButton />
          </ActionForm>
        </SectionCard>
      </TabsContent>

      <TabsContent value="digitalocean">
        <div className="space-y-6">
          <DoAccountsManager accounts={doAccounts} />
          <SectionCard
            title="Preferensi provisioning"
            description="Region default dan mode mock. Token akun dikelola di daftar akun di atas."
          >
            <ActionForm action={submitFor("digitalocean")} inlineError>
              <div className="space-y-2">
                <Label htmlFor="do_default_region">Region default</Label>
                <Input
                  id="do_default_region"
                  name="do_default_region"
                  required
                  defaultValue={settings.do_default_region}
                  placeholder="sgp1"
                />
              </div>
              <CheckField
                name="do_mock_mode"
                label="Mode mock"
                hint="Buat VPS palsu untuk pengembangan tanpa memanggil API DigitalOcean."
                defaultChecked={settings.do_mock_mode === "true"}
              />
              <SaveButton />
            </ActionForm>
          </SectionCard>
        </div>
      </TabsContent>

      <TabsContent value="pricing">
        <SectionCard title="Harga & margin" description="Dipakai untuk perhitungan modal, saran harga, dan jatuh tempo.">
          <ActionForm action={submitFor("pricing")} inlineError>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="usd_idr_rate">Kurs USD → IDR</Label>
                <Input id="usd_idr_rate" name="usd_idr_rate" type="number" min={1000} required defaultValue={settings.usd_idr_rate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_markup_percent">Markup default (%)</Label>
                <Input id="default_markup_percent" name="default_markup_percent" type="number" min={0} max={500} step="0.1" required defaultValue={settings.default_markup_percent} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice_due_reminder_days">Pengingat H- (hari)</Label>
                <Input id="invoice_due_reminder_days" name="invoice_due_reminder_days" defaultValue={settings.invoice_due_reminder_days} placeholder="3,1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grace_period_days">Masa tenggang (hari)</Label>
                <Input id="grace_period_days" name="grace_period_days" type="number" min={0} max={60} required defaultValue={settings.grace_period_days} />
              </div>
            </div>
            <p className="rounded-xl border border-[#E3E8E4] bg-[#F7F8F7] p-3 text-xs text-[#5B6B60]">
              Contoh: pengingat “3,1” mengirim notifikasi 3 hari dan 1 hari sebelum jatuh tempo. VPS
              ditangguhkan setelah masa tenggang berakhir.
            </p>
            <p className="rounded-xl border border-[#CFE6D8] bg-[#E7F4EC] p-3 text-xs text-[#0B3D2E]">
              Kurs dan markup dipakai untuk produk berlabel <strong>Otomatis</strong>. Setelah disimpan,
              harga produk otomatis dihitung ulang dan langsung tampil di landing page. Harga{" "}
              <strong>Custom</strong> tidak diubah.
            </p>
            <SaveButton />
          </ActionForm>
        </SectionCard>
      </TabsContent>

      <TabsContent value="payment">
        <div className="space-y-6">
          <SectionCard title="Transfer manual" description="Pembayaran dengan verifikasi bukti oleh admin.">
            <ActionForm action={submitFor("payment")} inlineError>
              <input type="hidden" name="tripay_enabled" value={settings.tripay_enabled} />
              <input type="hidden" name="tripay_api_key" value="" />
              <input type="hidden" name="tripay_private_key" value="" />
              <input type="hidden" name="tripay_merchant_code" value={settings.tripay_merchant_code} />
              <input type="hidden" name="tripay_is_sandbox" value={settings.tripay_is_sandbox} />
              <CheckField name="manual_enabled" label="Aktifkan transfer manual" defaultChecked={settings.manual_enabled === "true"} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manual_bank_name">Nama bank</Label>
                  <Input id="manual_bank_name" name="manual_bank_name" defaultValue={settings.manual_bank_name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual_account_number">Nomor rekening</Label>
                  <Input id="manual_account_number" name="manual_account_number" defaultValue={settings.manual_account_number} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual_account_name">Atas nama</Label>
                <Input id="manual_account_name" name="manual_account_name" defaultValue={settings.manual_account_name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual_instructions">Instruksi pembayaran</Label>
                <Textarea id="manual_instructions" name="manual_instructions" rows={3} defaultValue={settings.manual_instructions} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_providers_order">Urutan metode</Label>
                <Input id="payment_providers_order" name="payment_providers_order" defaultValue={settings.payment_providers_order} placeholder="manual,tripay" />
                <p className="text-xs text-[#8A9A90]">Pisahkan dengan koma. Provider nonaktif otomatis dilewati.</p>
              </div>
              <SaveButton>Simpan pembayaran manual</SaveButton>
            </ActionForm>
          </SectionCard>

          <SectionCard title="Tripay" description="Kredensial gateway. Daftar channel diambil otomatis dari API; kode channel tidak perlu diisi.">
            <ActionForm action={submitFor("payment")} inlineError>
              <input type="hidden" name="manual_enabled" value={settings.manual_enabled} />
              <input type="hidden" name="manual_bank_name" value={settings.manual_bank_name} />
              <input type="hidden" name="manual_account_number" value={settings.manual_account_number} />
              <input type="hidden" name="manual_account_name" value={settings.manual_account_name} />
              <input type="hidden" name="manual_instructions" value={settings.manual_instructions} />
              <input type="hidden" name="payment_providers_order" value={settings.payment_providers_order} />
              <CheckField name="tripay_enabled" label="Aktifkan Tripay" defaultChecked={settings.tripay_enabled === "true"} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tripay_api_key">API key</Label>
                  <Input id="tripay_api_key" name="tripay_api_key" type="password" autoComplete="off" placeholder={secrets.tripay_api_key ? "•••••••• (tersimpan)" : "DEV-…"} />
                  <SecretHint configured={secrets.tripay_api_key} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tripay_private_key">Private key</Label>
                  <Input id="tripay_private_key" name="tripay_private_key" type="password" autoComplete="off" placeholder={secrets.tripay_private_key ? "•••••••• (tersimpan)" : "…"} />
                  <SecretHint configured={secrets.tripay_private_key} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tripay_merchant_code">Merchant code</Label>
                  <Input id="tripay_merchant_code" name="tripay_merchant_code" defaultValue={settings.tripay_merchant_code} placeholder="T0001" />
                </div>
              </div>
              <p className="rounded-xl border border-[#CFE6D8] bg-[#E7F4EC] p-3 text-xs text-[#0B3D2E]">
                Kode channel tidak perlu diisi. Daftar channel aktif (QRIS, virtual account, retail)
                diambil otomatis dari API Tripay dan ditampilkan ke pengguna saat membayar.
              </p>
              <CheckField name="tripay_is_sandbox" label="Sandbox" hint="Matikan untuk transaksi produksi." defaultChecked={settings.tripay_is_sandbox === "true"} />
              <div className="space-y-2 rounded-xl border border-[#CFE6D8] bg-[#F3F9F5] p-4">
                <p className="text-xs font-semibold tracking-wide text-[#0B3D2E] uppercase">URL callback &amp; webhook</p>
                <code className="block break-all rounded-lg border border-[#CFE6D8] bg-white px-3 py-2 font-mono text-xs text-[#101613]">
                  {appUrl}/api/payments/tripay/webhook
                </code>
                <p className="text-xs leading-relaxed text-[#5B6B60]">
                  Daftarkan URL di atas sebagai callback di dashboard Tripay. Transaksi juga mengirim
                  <code className="mx-1 rounded bg-white px-1 py-0.5 font-mono text-[10px]">callback_url</code>
                  otomatis. Return URL diarahkan ke halaman invoice pengguna.
                </p>
                <p className="text-xs leading-relaxed text-[#5B6B60]">
                  Event yang diproses: <strong>payment_status</strong> dengan status PAID / UNPAID / EXPIRED / FAILED.
                </p>
              </div>
              <SaveButton>Simpan Tripay</SaveButton>
            </ActionForm>
          </SectionCard>
        </div>
      </TabsContent>

      <TabsContent value="email">
        <div className="space-y-6">
          <SectionCard title="SMTP" description="Kirim email lewat Gmail, SMTP relay, atau server mail sendiri.">
            <ActionForm action={submitFor("email")} inlineError>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <div className="space-y-2">
                  <Label htmlFor="smtp_host">SMTP host</Label>
                  <Input id="smtp_host" name="smtp_host" defaultValue={settings.smtp_host} placeholder="smtp.gmail.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_port">Port</Label>
                  <Input id="smtp_port" name="smtp_port" type="number" min={1} max={65535} required defaultValue={settings.smtp_port || "587"} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_secure">Keamanan koneksi</Label>
                <select
                  id="smtp_secure"
                  name="smtp_secure"
                  defaultValue={settings.smtp_secure === "true" ? "true" : "false"}
                  className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm"
                >
                  <option value="false">STARTTLS (biasanya port 587 atau 25)</option>
                  <option value="true">SSL/TLS langsung (biasanya port 465)</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp_user">Username</Label>
                  <Input id="smtp_user" name="smtp_user" autoComplete="username" defaultValue={settings.smtp_user} placeholder="nama@gmail.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_pass">Password / App Password</Label>
                  <Input id="smtp_pass" name="smtp_pass" type="password" autoComplete="new-password" placeholder={secrets.smtp_pass ? "•••••••• (tersimpan)" : "App Password Gmail / password SMTP"} />
                  <SecretHint configured={secrets.smtp_pass} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_from">Alamat pengirim (From)</Label>
                <Input id="email_from" name="email_from" required defaultValue={settings.email_from} placeholder={`${settings.site_name} <email@gmail.com>`} />
                <p className="text-xs leading-relaxed text-[#8A9A90]">
                  Untuk Gmail, gunakan App Password dan alamat Gmail yang sama dengan username. Kosongkan host untuk mode log tanpa mengirim email.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SaveButton>Simpan SMTP</SaveButton>
                <ActionButton action={() => testEmailAction()} className="border-[#BFE3CC] bg-white text-[#0B3D2E]" pendingText="Mengirim…">
                  Kirim email uji
                </ActionButton>
              </div>
            </ActionForm>
          </SectionCard>

          <SectionCard title="Template email" description="Placeholder seperti {nama}, {link}, {total} diganti otomatis." bodyClassName="p-0">
            <div className="divide-y divide-[#EDF1EE]">
              {emailTemplates.map((template) => (
                <details key={template.key} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3.5 hover:bg-[#F9FBFA]">
                    <div>
                      <p className="text-sm font-semibold text-[#101613]">{template.title}</p>
                      <p className="font-mono text-[10px] text-[#8A9A90]">{template.key}</p>
                    </div>
                    <span className="text-xs text-[#8A9A90]">{template.isCustom ? "Kustom" : "Default"}</span>
                  </summary>
                  <div className="border-t border-[#EDF1EE] bg-[#FBFCFB] px-5 py-4">
                    <ActionForm action={saveEmailTemplateAction.bind(null, template.key)} inlineError>
                      <div className="space-y-2">
                        <Label htmlFor={`subject-${template.key}`}>Subjek</Label>
                        <Input id={`subject-${template.key}`} name="subject" required defaultValue={template.subject} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`body-${template.key}`}>Isi</Label>
                        <Textarea id={`body-${template.key}`} name="body" rows={8} required defaultValue={template.body} className="font-mono text-xs" />
                      </div>
                      <SubmitButton variant="outline" pendingText="Menyimpan…" className="border-[#D8E2DB] bg-white">
                        Simpan template
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </details>
              ))}
            </div>
          </SectionCard>
        </div>
      </TabsContent>

      <TabsContent value="notification">
        <SectionCard title="Notifikasi WhatsApp" description="Dikirim lewat worker Baileys yang terhubung ke akun WhatsApp toko.">
          <ActionForm action={submitFor("notification")} inlineError>
            <CheckField
              name="wa_enabled"
              label="Aktifkan notifikasi WhatsApp"
              hint="Jika dimatikan, semua notifikasi WA masuk ke outbox tetapi tidak dikirim."
              defaultChecked={settings.wa_enabled === "true"}
            />
            <div className="space-y-2">
              <Label htmlFor="wa_notify_admin_numbers">Nomor admin</Label>
              <Textarea
                id="wa_notify_admin_numbers"
                name="wa_notify_admin_numbers"
                rows={2}
                defaultValue={settings.wa_notify_admin_numbers}
                placeholder="6281234567890, 6289876543210"
              />
              <p className="text-xs text-[#8A9A90]">Pisahkan dengan koma, titik koma, atau baris baru.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-[#101613]">Event untuk admin</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {adminEvents.map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg border border-[#E3E8E4] bg-white px-3 py-2 text-sm">
                    <input type="checkbox" name="wa_admin_events" value={value} defaultChecked={adminEventValues.includes(value)} className="accent-[#0B3D2E]" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-[#101613]">Event untuk pelanggan</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {userEvents.map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg border border-[#E3E8E4] bg-white px-3 py-2 text-sm">
                    <input type="checkbox" name="wa_user_events" value={value} defaultChecked={userEventValues.includes(value)} className="accent-[#0B3D2E]" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <SaveButton />
          </ActionForm>
        </SectionCard>
      </TabsContent>
    </Tabs>
  );
}
