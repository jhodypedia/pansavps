import { db } from "@/lib/db/core";
import { waTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const WA_TEMPLATE_KEYS = [
  "verification",
  "welcome",
  "invoice_created",
  "order_created",
  "topup_success",
  "payment_paid",
  "payment_rejected",
  "refund_processed",
  "balance_adjusted",
  "provisioning_done",
  "provisioning_failed",
  "invoice_reminder",
  "weekly_expiry_reminder",
  "service_suspended",
  "service_terminated",
  "service_renewed",
  "upgrade_success",
  "ticket_replied",
  "password_reset",
] as const;

export type WaTemplateKey = (typeof WA_TEMPLATE_KEYS)[number] | string;

export const WA_PLACEHOLDERS = [
  "nama",
  "code",
  "order_number",
  "invoice_number",
  "jenis_invoice",
  "nama_paket",
  "ip",
  "hostname",
  "region",
  "os",
  "jatuh_tempo",
  "total",
  "saldo",
  "link",
  "password",
  "ticket_number",
  "subject",
  "alasan",
  "catatan",
  "refund_info",
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
  invoice_created: {
    title: "Invoice dibuat",
    body: `🧾 *INVOICE BARU DIBUAT*

Hai {nama} 👋
Invoice {jenis_invoice} kamu sudah dibuat dan menunggu pembayaran.

🔖 Invoice: {invoice_number}
💰 Total: {total}
⏰ Bayar sebelum: {jatuh_tempo}

👉 Bayar sekarang:
{link}

_Setelah pembayaran terverifikasi, pesanan atau saldo akan diproses otomatis._`,
  },
  order_created: {
    title: "Pesanan dibuat",
    body: `🛒 *PESANAN VPS DIBUAT*

Hai {nama} 👋
Pesanan VPS kamu sudah dibuat dan menunggu pembayaran.

📦 Paket: {nama_paket}
🔖 Order: {order_number}
💰 Total: {total}
⏰ Bayar sebelum: {jatuh_tempo}

👉 Bayar sekarang:
{link}

_Pesanan otomatis kedaluwarsa jika belum dibayar._`,
  },
  topup_success: {
    title: "Top up saldo berhasil",
    body: `💰 *TOP UP SALDO BERHASIL*

Hai {nama} 👋
Saldo akun kamu sudah bertambah.

🔖 Invoice: {invoice_number}
➕ Nominal: {total}
💳 Saldo sekarang: {saldo}

Saldo bisa langsung dipakai untuk pesanan baru, perpanjangan, atau upgrade.

Lihat saldo:
{link}`,
  },
  payment_paid: {
    title: "Pembayaran diterima",
    body: `✅ *PEMBAYARAN VPS DITERIMA*

Hai {nama} 👋
Pembayaran pesanan VPS kamu sudah kami terima.

🔖 Order: {order_number}
💰 Total: {total}

Server sedang disiapkan. Kami akan mengirim detail akses setelah VPS aktif.

Lihat status:
{link}`,
  },
  payment_rejected: {
    title: "Pembayaran ditolak",
    body: `⚠️ *BUKTI PEMBAYARAN DITOLAK*

Hai {nama},
Bukti pembayaran untuk invoice {invoice_number} belum dapat kami verifikasi.

📝 Alasan: {alasan}

Silakan unggah ulang bukti pembayaran atau hubungi support dari dashboard.

Cek invoice:
{link}`,
  },
  refund_processed: {
    title: "Refund ke saldo",
    body: `↩️ *REFUND KE SALDO*

Hai {nama} 👋
Dana untuk pesanan {order_number} sudah dikembalikan ke saldo akun.

💰 Nominal: {total}
💳 Saldo sekarang: {saldo}
📝 Catatan: {alasan}

Lihat saldo dan riwayat:
{link}

_Refund tercatat di riwayat dan tidak dihitung sebagai pemakaian saldo._`,
  },
  balance_adjusted: {
    title: "Saldo disesuaikan",
    body: `⚖️ *PENYESUAIAN SALDO*

Hai {nama} 👋
Saldo akun kamu telah disesuaikan oleh tim {brand}.

💰 Perubahan: {total}
💳 Saldo sekarang: {saldo}
📝 Catatan: {catatan}

Lihat saldo:
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

⚠️ _Simpan data akses ini. Jangan bagikan password kepada siapa pun._`,
  },
  provisioning_failed: {
    title: "Pembuatan server gagal",
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
  weekly_expiry_reminder: {
    title: "VPS mingguan segera berakhir",
    body: `⏰ *VPS MINGGUAN SEGERA BERAKHIR*

Hai {nama} 👋
VPS mingguan kamu akan berakhir dan *dihapus otomatis*.

🖥️ Hostname: {hostname}
📅 Berakhir: {jatuh_tempo}

Perpanjang sekarang sebelum droplet dihapus:
{link}

_Data pada droplet yang sudah dihapus tidak dapat dipulihkan._`,
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
VPS {hostname} telah dihentikan dan droplet dihapus. Paket mingguan dihapus otomatis setelah 7 hari; paket lainnya setelah masa tenggang.

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
  upgrade_success: {
    title: "Upgrade VPS berhasil",
    body: `⬆️ *UPGRADE VPS BERHASIL*

Hai {nama} 👋
VPS kamu sudah ditingkatkan ke paket {nama_paket}.

🖥️ Hostname: {hostname}
📅 Berlaku sampai: {jatuh_tempo}

Lihat detail VPS:
{link}

_Terima kasih sudah mempercayakan layanan kamu kepada {brand}._`,
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
  password_reset: {
    title: "Password diubah",
    body: `🔐 *PASSWORD AKUN DIUBAH*

Hai {nama},
Password akun {brand} kamu baru saja diubah. Semua sesi lain sudah dikeluarkan.

Jika ini bukan kamu, segera hubungi support.

{link}`,
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
