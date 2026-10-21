import { db } from "@/lib/db/core";
import { waTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const WA_TEMPLATE_KEYS = [
  "verification",
  "welcome",
  "order_created",
  "payment_paid",
  "provisioning_done",
  "provisioning_failed",
  "invoice_reminder",
  "service_suspended",
  "service_terminated",
  "service_renewed",
  "ticket_replied",
] as const;

export type WaTemplateKey = (typeof WA_TEMPLATE_KEYS)[number] | string;

export const WA_PLACEHOLDERS = [
  "nama",
  "code",
  "order_number",
  "invoice_number",
  "nama_paket",
  "ip",
  "hostname",
  "region",
  "os",
  "jatuh_tempo",
  "total",
  "link",
  "password",
  "ticket_number",
  "subject",
  "alasan",
];

export const DEFAULT_WA_TEMPLATES: Record<
  string,
  { title: string; body: string }
> = {
  verification: {
    title: "Kode verifikasi akun",
    body: `🔐 *KODE VERIFIKASI {brand}*

Hai {nama} 👋
Gunakan kode di bawah untuk memverifikasi akun kamu:

*{code}*

⏳ Kode berlaku 10 menit.
Jangan bagikan kode ini kepada siapa pun.

Masukkan kode di halaman Verifikasi Akun. Jika kamu tidak merasa mendaftar, abaikan pesan ini.`,
  },
  welcome: {
    title: "Pendaftaran berhasil",
    body: `✨ *SELAMAT DATANG DI {brand}*

Hai {nama} 👋
Akun kamu berhasil dibuat.

Langkah berikutnya:
1. Verifikasi akun via WhatsApp/email
2. Pilih paket VPS
3. Selesaikan pembayaran

Masuk ke dashboard:
{link}

Butuh bantuan? Balas pesan ini.`,
  },
  order_created: {
    title: "Pesanan dibuat",
    body: `🧾 *PESANAN DIBUAT*

Hai {nama} 👋
Pesanan kamu sudah dibuat dan menunggu pembayaran.

📦 Paket: {nama_paket}
🔖 Order: {order_number}
💰 Total: {total}
⏰ Bayar sebelum: {jatuh_tempo}

👉 Bayar sekarang:
{link}

_Pesanan otomatis kedaluwarsa jika belum dibayar._`,
  },
  payment_paid: {
    title: "Pembayaran diterima",
    body: `✅ *PEMBAYARAN DITERIMA*

Hai {nama} 👋
Pembayaran kamu sudah kami terima.

🔖 Order: {order_number}
💰 Total: {total}

Server sedang disiapkan. Kami akan mengirim detail akses setelah VPS aktif.

Lihat status:
{link}`,
  },
  provisioning_done: {
    title: "VPS aktif",
    body: `🎉 *VPS KAMU SUDAH AKTIF!*

Hai {nama} 👋
Server kamu siap digunakan.

📦 Paket: {nama_paket}
🖥️ Hostname: {hostname}
🌐 IP: {ip}
👤 User: root
🔑 Password: *{password}*
📍 Region: {region}
💿 OS: {os}
📅 Berlaku sampai: {jatuh_tempo}

Kelola VPS:
{link}

⚠️ _Simpan kredensial ini. Jangan bagikan password kepada siapa pun._`,
  },
  provisioning_failed: {
    title: "Provisioning gagal",
    body: `⚠️ *VPS BELUM BERHASIL DIBUAT*

Hai {nama},
Kami mengalami kendala saat menyiapkan {hostname}.

Tim kami sudah diberi tahu. {refund_info}

Cek pesanan:
{link}

Jika masih terkendala, balas pesan ini.`,
  },
  invoice_reminder: {
    title: "Pengingat jatuh tempo",
    body: `⏰ *PENGINGAT JATUH TEMPO*

Hai {nama} 👋
Masa aktif VPS kamu akan segera berakhir.

🖥️ Hostname: {hostname}
📅 Jatuh tempo: {jatuh_tempo}

Perpanjang sekarang agar layanan tetap aktif:
{link}

_Data masih tersimpan selama masa tenggang._`,
  },
  service_suspended: {
    title: "Layanan ditangguhkan",
    body: `⛔ *LAYANAN DITANGGUHKAN*

Hai {nama},
VPS {hostname} ditangguhkan karena masa aktif berakhir.

Data kamu masih tersimpan selama masa tenggang.

Aktifkan kembali:
{link}

Segera perpanjang sebelum data dihapus.`,
  },
  service_terminated: {
    title: "Layanan dihentikan",
    body: `🗑️ *LAYANAN DIHENTIKAN*

Hai {nama},
VPS {hostname} telah dihentikan dan droplet dihapus karena melewati masa tenggang.

Data pada droplet yang sudah dihapus tidak dapat dipulihkan.

Butuh bantuan? Balas pesan ini.`,
  },
  service_renewed: {
    title: "Layanan diperpanjang",
    body: `✅ *VPS BERHASIL DIPERPANJANG*

Hai {nama} 👋
Masa aktif VPS kamu sudah diperpanjang.

🖥️ Hostname: {hostname}
📅 Berlaku sampai: {jatuh_tempo}

Lihat detail:
{link}

Terima kasih sudah mempercayakan layanan kamu kepada {brand}.`,
  },
  ticket_replied: {
    title: "Tiket dibalas",
    body: `💬 *TIKET KAMU SUDAH DIBALAS*

Hai {nama},
Tim support sudah membalas tiket kamu.

🎫 Tiket: {ticket_number}
📝 Subjek: {subject}

Lihat balasan:
{link}

Balas tiket di dashboard jika masih butuh bantuan.`,
  },
};

export function renderWaTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? `{${key}}` : String(v);
  });
}

export function getWaTemplate(key: string) {
  return db.select().from(waTemplates).where(eq(waTemplates.key, key)).get();
}

export function waTemplateBody(key: string): string | null {
  const row = getWaTemplate(key);
  return row?.body ?? DEFAULT_WA_TEMPLATES[key]?.body ?? null;
}
