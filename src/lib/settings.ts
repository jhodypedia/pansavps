import { eq } from "drizzle-orm";
import { db } from "@/lib/db/core";
import { doAccounts, settings } from "@/lib/db/schema";
import { decrypt, encrypt, isEncrypted } from "@/lib/crypto";

/** Nilai default — seed menulis ini ke DB agar admin bisa mengubahnya. */
export const SETTING_DEFAULTS: Record<string, string> = {
  site_name: "PansaVPS",
  site_tagline: "Cloud VPS cepat, aktif dalam hitungan detik.",
  site_description:
    "VPS performa tinggi dengan aktivasi otomatis, panel kontrol lengkap, dan support WhatsApp 24/7.",
  site_logo_url: "",
  site_favicon_url: "",
  support_email: "support@pansavps.id",
  support_whatsapp: "6281234567890",
  usd_idr_rate: "16500",
  default_markup_percent: "30",
  maintenance_mode: "false",
  announcement_active: "false",
  announcement_text: "",
  announcement_link: "",
  announcement_tone: "info",

  do_token: "",
  do_default_region: "sgp1",
  do_mock_mode: "true",
  do_catalog_last_sync: "",

  tripay_enabled: "false",
  tripay_api_key: "",
  tripay_private_key: "",
  tripay_merchant_code: "",
  tripay_is_sandbox: "true",

  manual_enabled: "true",
  manual_bank_name: "BCA",
  manual_account_number: "1234567890",
  manual_account_name: "PT Pansa Digital Nusantara",
  manual_instructions:
    "Transfer tepat sesuai nominal invoice. Setelah transfer, unggah bukti pembayaran di halaman invoice. Verifikasi maksimal 1x24 jam pada hari kerja.",

  payment_providers_order: "manual,tripay",
  default_order_expiry_hours: "24",

  smtp_host: "",
  smtp_port: "587",
  smtp_secure: "false",
  smtp_user: "",
  smtp_pass: "",
  email_from: "PansaVPS <noreply@pansavps.id>",
  email_templates:
    "order_created,payment_paid,provisioning_done,provisioning_failed,invoice_reminder,weekly_expiry_reminder,service_suspended,service_terminated,service_renewed,ticket_replied,welcome,verification,password_reset",

  wa_enabled: "true",
  wa_notify_admin_numbers: "",
  wa_admin_events:
    '["order_created","payment_paid","provisioning_failed","ticket_created","topup_pending","service_terminated"]',
  wa_user_events:
    '["welcome","order_created","payment_paid","provisioning_done","invoice_reminder","weekly_expiry_reminder","service_suspended","service_terminated","service_renewed","ticket_replied"]',

  invoice_due_reminder_days: "3,1",
  grace_period_days: "3",
  invoice_due_days: "3",

  captcha_enabled: "false",
  turnstile_site_key: "",
  turnstile_secret_key: "",

  security_force_logout_at: "",
};

export const ENCRYPTED_SETTING_KEYS = new Set([
  "do_token",
  "tripay_api_key",
  "tripay_private_key",
  "smtp_pass",
  "turnstile_secret_key",
]);

export type SettingsMap = Record<string, string>;

export function getSettings(): SettingsMap {
  const rows = db.select().from(settings).all();
  const map: SettingsMap = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    try {
      map[row.key] = isEncrypted(row.value) ? decrypt(row.value) : row.value;
    } catch {
      map[row.key] = "";
    }
  }
  return map;
}

export function getSetting(key: string): string {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return SETTING_DEFAULTS[key] ?? "";
  try {
    return isEncrypted(row.value) ? decrypt(row.value) : row.value;
  } catch {
    return "";
  }
}

export function setSetting(key: string, value: string, updatedBy?: string): void {
  const stored = ENCRYPTED_SETTING_KEYS.has(key) && value ? encrypt(value) : value;
  db.insert(settings)
    .values({ key, value: stored, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: stored, updatedBy, updatedAt: new Date() },
    })
    .run();
}

export function setSettings(values: Record<string, string>, updatedBy?: string): void {
  for (const [key, value] of Object.entries(values)) setSetting(key, value, updatedBy);
}

export function boolSetting(key: string): boolean {
  return getSetting(key) === "true";
}

export function numberSetting(key: string): number {
  const n = Number(getSetting(key));
  return Number.isFinite(n) ? n : 0;
}

export function isMockMode(): boolean {
  if (getSetting("do_mock_mode") === "true") return true;
  const account = db
    .select({ id: doAccounts.id })
    .from(doAccounts)
    .where(eq(doAccounts.isActive, true))
    .get();
  if (account) return false;
  // Fallback untuk instalasi lama sebelum token dipindahkan ke tabel akun.
  return !getSetting("do_token");
}

export type PublicBrand = {
  siteName: string;
  tagline: string;
  description: string;
  logoUrl: string;
  faviconUrl: string;
  supportEmail: string;
  supportWhatsapp: string;
  announcement: { active: boolean; text: string; link: string; tone: string };
  maintenance: boolean;
};

export function getPublicBrand(): PublicBrand {
  const s = getSettings();
  return {
    siteName: s.site_name || "PansaVPS",
    tagline: s.site_tagline,
    description: s.site_description,
    logoUrl: s.site_logo_url,
    faviconUrl: s.site_favicon_url,
    supportEmail: s.support_email,
    supportWhatsapp: s.support_whatsapp,
    announcement: {
      active: s.announcement_active === "true" && Boolean(s.announcement_text),
      text: s.announcement_text,
      link: s.announcement_link,
      tone: s.announcement_tone || "info",
    },
    maintenance: s.maintenance_mode === "true",
  };
}

/** Template email default (bisa diedit admin lewat Pengaturan > Notifikasi). */
export const DEFAULT_EMAIL_TEMPLATES: Record<
  string,
  { title: string; subject: string; body: string }
> = {
  welcome: {
    title: "Selamat datang",
    subject: "Selamat datang di {brand} ✨",
    body: `Halo {nama} 👋

**Selamat datang di {brand}!**
Akun kamu berhasil dibuat. Sekarang kamu bisa memesan VPS dengan aktivasi otomatis.

## Langkah cepat
- Verifikasi akun via WhatsApp atau email
- Pilih paket dan region
- Selesaikan pembayaran
- Server aktif otomatis

[Buka dashboard]({link})

> Simpan email ini sebagai bukti pendaftaran akun kamu.

Terima kasih,
{brand}`,
  },
  verification: {
    title: "Verifikasi email",
    subject: "Verifikasi email {brand} kamu",
    body: `Halo {nama} 👋

**Verifikasi email kamu**
Satu langkah lagi untuk mengaktifkan akun {brand}. Klik tombol di bawah untuk memverifikasi email kamu.

[Verifikasi email]({link})

Tautan berlaku **24 jam**. Jika kamu tidak mendaftar, abaikan email ini.

> Demi keamanan, jangan teruskan email ini ke siapa pun.

{brand}`,
  },
  password_reset: {
    title: "Reset password",
    subject: "Reset password {brand}",
    body: `Halo {nama} 👋

**Permintaan reset password**
Kami menerima permintaan untuk membuat password baru untuk akun {brand} kamu.

[Buat password baru]({link})

Tautan berlaku **1 jam**. Jika kamu tidak meminta reset, abaikan email ini dan password kamu tetap aman.

> Tim {brand} tidak akan pernah meminta password atau kode OTP kamu.

{brand}`,
  },
  order_created: {
    title: "Pesanan dibuat",
    subject: "Pesanan {order_number} menunggu pembayaran",
    body: `Halo {nama} 👋

**Pesanan kamu sudah dibuat**
Terima kasih! Pesanan berikut menunggu pembayaran.

Order: {order_number}
Paket: {nama_paket}
Total: {total}
Batas pembayaran: {jatuh_tempo}

[Bayar sekarang]({link})

> Selesaikan pembayaran sebelum batas waktu agar pesanan tidak kedaluwarsa.

{brand}`,
  },
  payment_paid: {
    title: "Pembayaran diterima",
    subject: "Pembayaran {order_number} diterima ✅",
    body: `Halo {nama} 👋

**Pembayaran berhasil diterima**
Terima kasih! Pembayaran kamu sudah kami terima dan server sedang disiapkan.

Order: {order_number}
Total: {total}

[Lihat status pesanan]({link})

> Proses provisioning biasanya selesai dalam beberapa menit. Kami akan mengirim detail akses setelah server aktif.

{brand}`,
  },
  provisioning_done: {
    title: "VPS aktif",
    subject: "VPS {hostname} sudah aktif 🎉",
    body: `Halo {nama} 🎉

**VPS kamu sudah aktif!**
Server siap digunakan. Berikut detail aksesnya.

Paket: {nama_paket}
Hostname: {hostname}
IP: {ip}
User: root
Password: {password}
Region: {region}
OS: {os}
Berlaku sampai: {jatuh_tempo}

[Kelola VPS]({link})

> Simpan kredensial ini di tempat aman. Jangan bagikan password kepada siapa pun, termasuk yang mengaku sebagai tim {brand}.

{brand}`,
  },
  provisioning_failed: {
    title: "Provisioning gagal",
    subject: "VPS {hostname} gagal dibuat",
    body: `Halo {nama},

**Kami belum berhasil membuat VPS kamu**
Terjadi kendala saat menyiapkan {hostname}. Tim kami sudah diberi tahu.

{refund_info}

[Cek pesanan]({link})

> Jika kendala berlanjut, hubungi support dan sertakan nomor pesanan kamu.

{brand}`,
  },
  weekly_expiry_reminder: {
    title: "VPS mingguan segera berakhir",
    subject: "VPS mingguan {hostname} berakhir {jatuh_tempo}",
    body: `Halo {nama} ⏰

**VPS mingguan kamu segera berakhir**
VPS {hostname} akan berakhir pada {jatuh_tempo}. Karena ini paket mingguan, droplet akan **dihapus otomatis** saat masa aktif selesai.

Hostname: {hostname}
Berakhir: {jatuh_tempo}

[Perpanjang sekarang]({link})

> Data pada droplet yang sudah dihapus tidak dapat dipulihkan. Perpanjang sebelum batas waktu jika masih membutuhkan server.

{brand}`,
  },
  invoice_reminder: {
    title: "Pengingat jatuh tempo",
    subject: "VPS {hostname} jatuh tempo {jatuh_tempo}",
    body: `Halo {nama} ⏰

**Masa aktif VPS segera berakhir**
VPS {hostname} akan jatuh tempo pada {jatuh_tempo}. Perpanjang sekarang agar layanan tetap aktif.

Hostname: {hostname}
Jatuh tempo: {jatuh_tempo}

[Perpanjang sekarang]({link})

> Jika auto-renew aktif dan saldo cukup, perpanjangan diproses otomatis.

{brand}`,
  },
  service_suspended: {
    title: "Layanan ditangguhkan",
    subject: "VPS {hostname} ditangguhkan",
    body: `Halo {nama},

**Layanan VPS ditangguhkan**
VPS {hostname} ditangguhkan karena masa aktif berakhir. Data kamu masih tersimpan selama masa tenggang.

Hostname: {hostname}
Status: Ditangguhkan

[Perpanjang & aktifkan kembali]({link})

> Segera perpanjang sebelum masa tenggang berakhir agar data dan droplet tidak dihapus.

{brand}`,
  },
  service_terminated: {
    title: "Layanan dihentikan",
    subject: "VPS {hostname} telah dihentikan",
    body: `Halo {nama},

**Layanan VPS telah dihentikan**
VPS {hostname} telah dihentikan dan droplet dihapus. Paket mingguan dihapus otomatis setelah 7 hari; paket lainnya setelah masa tenggang.

Hostname: {hostname}
Status: Dihentikan

[Lihat layanan]({link})

> Data pada droplet yang sudah dihapus tidak dapat dipulihkan.

{brand}`,
  },
  service_renewed: {
    title: "Layanan diperpanjang",
    subject: "VPS {hostname} berhasil diperpanjang ✅",
    body: `Halo {nama} ✅

**VPS berhasil diperpanjang**
Masa aktif VPS {hostname} sudah diperpanjang.

Hostname: {hostname}
Berlaku sampai: {jatuh_tempo}

[Lihat detail VPS]({link})

> Terima kasih sudah mempercayakan infrastruktur kamu kepada {brand}.

{brand}`,
  },
  ticket_replied: {
    title: "Balasan tiket",
    subject: "Tiket {ticket_number} dibalas 💬",
    body: `Halo {nama} 💬

**Tiket kamu sudah dibalas**
Tim support sudah memberikan balasan untuk tiket "{subject}".

Tiket: {ticket_number}
Subjek: {subject}

[Lihat balasan]({link})

> Balas tiket di dashboard jika kamu masih membutuhkan bantuan.

{brand}`,
  },
};

export const DEFAULT_EMAIL_TEMPLATE = `Halo {nama},

Ada pembaruan untuk akun {brand}.

{link}

{brand}`;
