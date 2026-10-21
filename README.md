# PansaVPS — VPS Store

Toko VPS produksi dengan provider **DigitalOcean**, dashboard pengguna, panel admin, pembayaran manual/gateway, provisioning otomatis (dengan mode mock), dan notifikasi WhatsApp melalui Baileys.

Stack: **Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · shadcn/ui (new-york) · Drizzle ORM + SQLite · Zod + React Hook Form · SMTP (Nodemailer) · Tripay · Baileys · Recharts · TanStack Table**.

---

## 1. Fitur utama

**Publik**
- Landing page, katalog harga, fitur, FAQ, kontak, status layanan, halaman legal (S&K, privasi, refund, SLA).
- Harga, nama brand, kontak, dan pengumuman dibaca dari database — bukan hardcoded.
- SEO: metadata dinamis, sitemap, robots, JSON-LD.

**Pengguna**
- Registrasi, login, verifikasi email, lupa/reset password, sesi perangkat.
- Dashboard: ringkasan, daftar VPS + detail, kontrol daya, rebuild, snapshot, ganti hostname, password root, auto-renew, upgrade paket.
- Pesanan + checkout 4 langkah (paket → region/OS → SSH → pembayaran), kode promo.
- Invoice, unggah bukti transfer, bayar dengan saldo/gateway, unduh PDF.
- Saldo & top up, tiket support, SSH keys, notifikasi, pengaturan profil/keamanan.

**Admin**
- Ringkasan bisnis, pesanan (retry provisioning, refund, cancel), layanan (suspend, terminate, reveal password, snapshot).
- Invoice & verifikasi pembayaran manual, pengguna (role/status/saldo), paket (harga, margin, riwayat harga), promo.
- Tiket (balas, catatan internal, prioritas), pengaturan (umum, pembayaran, DigitalOcean, email, notifikasi, template email), log audit/cron/email/WhatsApp.
- Panel WhatsApp: status koneksi, QR, pairing code, tes kirim, retry outbox, editor template. Hanya admin.

**Sistem**
- Provisioning mock default (`do_mock_mode=true`) memakai antrean job + IP dokumentasi `203.0.113.x`.
- Provisioning nyata memakai DigitalOcean API dan password root terenkripsi AES-256-GCM.
- Cron: provisioning, kedaluwarsa invoice, pengingat, auto-renew, suspend, terminasi, sinkron droplet, sinkron pembayaran Tripay, refund provisioning gagal, dorong outbox WhatsApp.
- Webhook Tripay dengan verifikasi signature, nominal, dan idempotensi; status invoice juga disinkronkan ulang lewat API status dan cron.
- Refund otomatis ke saldo jika provisioning gagal final, termasuk penolakan DigitalOcean karena droplet limit.
- Rate limit, audit log, role guard di server, security headers, cookie HttpOnly.

---

## 2. Prasyarat

- Node.js **≥ 20.9** (disarankan Node 22/24)
- npm 10+
- Build tools untuk `better-sqlite3` (di Debian/Ubuntu: `build-essential python3`)
- Tidak perlu database server — SQLite disimpan di `data/app.db`

---

## 3. Menjalankan

```bash
cp .env.example .env
# isi APP_ENCRYPTION_KEY (openssl rand -hex 32), ADMIN_PASSWORD,
# CRON_SECRET, INTERNAL_SECRET

npm install
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

Buka `http://localhost:3000`. Login admin memakai `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `.env` (default proyek: `admin@pansavps.id`).

Untuk pengembangan: `npm run dev`.

### Perintah npm

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` / `npm run start` | Build & server produksi |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate migrasi dari `src/lib/db/schema.ts` |
| `npm run db:migrate` | Terapkan migrasi |
| `npm run db:seed` | Seed idempoten: setting, admin, paket, region/OS, template WA, promo `HEMAT10` |
| `npm run db:reset` | **Hapus** database lalu buat ulang + seed |
| `npm run db:studio` | Drizzle Studio |
| `npm run cron:run` | Jalankan seluruh tugas cron sekali |
| `npm run smoke` | Smoke test alur pesanan → bayar → provisioning → aktif |
| `npm run wa:worker` | Worker WhatsApp Baileys (HTTP internal :3001) |

---

## 4. Konfigurasi `.env`

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `APP_URL` | ya | URL publik, dipakai untuk link email/WA dan redirect pembayaran |
| `DATABASE_URL` | ya | Path SQLite, default `./data/app.db` |
| `APP_ENCRYPTION_KEY` | ya | 64 karakter hex untuk AES-256-GCM (token DO, API key, dsb.) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | saat seed | Akun admin awal. Password hanya dipakai jika user belum ada |
| `CRON_SECRET` | ya | Bearer/`x-cron-secret` untuk `/api/cron` |
| `INTERNAL_SECRET` | ya | Autentikasi antara app dan worker WhatsApp |
| `WA_WORKER_URL` | ya | Alamat worker, default `http://127.0.0.1:3001` |
| `DIGITALOCEAN_TOKEN` | tidak | Alternatif token dari panel admin |
| `WA_WORKER_PORT` | tidak | Port worker, default `3001` |

**Jangan mengganti `APP_ENCRYPTION_KEY` setelah ada data terenkripsi** — nilai lama tidak bisa didekripsi.

Pengaturan operasional (brand, harga USD→IDR, markup, mode mock, pembayaran, SMTP, WhatsApp, masa tenggang) diubah dari **Admin → Pengaturan** dan disimpan di tabel `settings`.

---

## 5. Mode mock vs DigitalOcean asli

Default `do_mock_mode = true` (atau token DO kosong). Pada mode ini:
- Droplet tidak benar-benar dibuat.
- Job provisioning berjalan 2 langkah dengan jeda 8–15 detik dan IP `203.0.113.x`.
- Password root dibuat acak, dienkripsi, dan dikirim lewat email/WA.

Untuk produksi:
1. Isi **Admin → Pengaturan → DigitalOcean** dengan token, region default, lalu matikan mock mode.
2. Pastikan token memiliki izin droplet, snapshot, dan firewall yang dibutuhkan.
3. Buka **Admin → Paket VPS**. Panel **Katalog DigitalOcean** menarik produk dari endpoint `GET /v2/sizes`; klik **Sinkronkan dari DO** untuk menambah produk baru dan memperbarui spesifikasi/modal.
4. Harga produk berlabel **Otomatis** mengikuti kurs & markup di **Pengaturan → Harga**. Harga **Custom** dipertahankan.
5. Uji dengan satu pesanan berbiaya kecil sebelum membuka trafik.

Produk aktif juga tersedia untuk integrasi eksternal melalui `GET /api/products`.

---

## 6. Pembayaran

| Metode | Alur |
| --- | --- |
| Manual transfer | Invoice dibuat → pengguna unggah bukti → admin verifikasi di **Verifikasi Pembayaran** |
| Saldo | Langsung dipotong saat checkout; invoice lunas seketika |
| Tripay | Redirect ke halaman pembayaran Tripay; status dikonfirmasi lewat webhook |

Aktifkan gateway dan isi kredensial di **Admin → Pengaturan → Pembayaran**. Daftarkan URL berikut di dashboard provider:

- Tripay callback/webhook: `https://cloud.hgitopup.web.id/api/payments/tripay/webhook`
- Return URL transaksi: `https://cloud.hgitopup.web.id/dashboard/invoices/<id>?bayar=tripay`

Callback URL juga dikirim otomatis pada setiap transaksi. Daftarkan URL webhook di dashboard Tripay agar callback tetap diterima jika konfigurasi transaksi berubah.

Webhook memverifikasi signature, mencocokkan nominal invoice, dan idempoten — callback berulang tidak menggandakan pembayaran atau provisioning.

> Untuk percobaan lokal, gunakan metode **manual** atau **saldo**. Gateway memerlukan URL publik (HTTPS).

---

## 7. WhatsApp (Baileys)

Worker berjalan terpisah dari Next.js dan berkomunikasi lewat HTTP internal.

```bash
npm run wa:worker
```

Alur:
1. Pastikan `INTERNAL_SECRET` sama di `.env` aplikasi dan worker.
2. Buka **Admin → WhatsApp**, pilih QR atau pairing code, lalu hubungkan nomor.
3. Status, QR, dan sesi disimpan di `data/wa-auth` — **mount volume ini secara persisten**.
4. Pesan masuk ke tabel `wa_outbox`; worker mengirimkannya. Cron memanggil `/process-outbox` setiap menit dan mengembalikan pesan macet ke antrean.

Endpoint internal worker: `GET /health`, `GET /status`, `POST /pair`, `POST /logout`, `POST /process-outbox` (semua kecuali health memerlukan header `x-internal-secret`).

Catatan: pairing memerlukan lingkungan dengan koneksi WhatsApp yang stabil; tidak dapat diuji sepenuhnya secara headless. Logout dari panel akan menghapus sesi dan menampilkan QR baru.

---

## 8. Cron

Jalankan lewat scheduler eksternal (cron/systemd timer) setiap menit:

```cron
* * * * * cd /srv/pansavps && /usr/bin/npm run cron:run >> /var/log/pansavps-cron.log 2>&1
```

Atau panggil endpoint HTTP:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://domain-anda/api/cron
```

Tugas: `provisioning`, `refund_failed_provisioning`, `expire_invoices`, `reminders`, `renewals`, `terminations`, `sync_droplets`, `sync_tripay`, `wa_outbox`. Hasil setiap eksekusi tercatat di `cron_logs` dan dapat dilihat di **Admin → Log**.

Interval satu menit diperlukan agar provisioning mock/nyata dan pengingat berjalan tepat waktu.

---

## 9. Struktur proyek

```
src/
  app/
    (public)/          landing, pricing, fitur, faq, kontak, status, legal
    (auth)/            login, register, verifikasi, lupa/reset password
    dashboard/         area pengguna
    admin/             area admin
    api/               cron, webhook, status polling, PDF invoice, bukti bayar
  components/
    ui/                komponen shadcn
    shared/            header/footer publik, data table, status badge, dll.
    dashboard/         shell, form, editor, panel WhatsApp
  lib/
    db/                schema Drizzle, koneksi, seed, reset
    payments/          Tripay
    whatsapp/          template & antrean
    auth, crypto, settings, pricing, format, validators, ...
  server/
    actions/           server actions (auth, akun, pesanan, layanan, tiket, admin)
    services/          billing, orders, provisioning, services, cron
workers/wa-bot.ts      worker Baileys
scripts/cron.ts        runner cron
scripts/smoke.ts       smoke test alur inti
drizzle/               migrasi SQL
data/                  SQLite + sesi WhatsApp (runtime, jangan di-commit)
```

### Rute penting

| Area | Rute |
| --- | --- |
| Publik | `/`, `/pricing`, `/fitur`, `/faq`, `/kontak`, `/status` |
| Auth | `/login`, `/register`, `/verifikasi-email`, `/forgot-password`, `/reset-password` |
| Dashboard | `/dashboard`, `/dashboard/vps`, `/dashboard/pesanan`, `/dashboard/invoices`, `/dashboard/saldo`, `/dashboard/tiket`, `/dashboard/ssh-keys`, `/dashboard/notifikasi`, `/dashboard/pengaturan` |
| Admin | `/admin`, `/admin/orders`, `/admin/services`, `/admin/invoices`, `/admin/payments`, `/admin/users`, `/admin/plans`, `/admin/promo`, `/admin/tickets`, `/admin/settings`, `/admin/whatsapp`, `/admin/logs` |

---

## 10. Keamanan

- Password: bcrypt (12 rounds). Sesi: token acak, disimpan sebagai hash SHA-256, cookie `HttpOnly`/`SameSite=Lax` (Secure di produksi).
- Otorisasi dicek di server layout/action; `src/proxy.ts` hanya melakukan redirect awal berbasis cookie.
- Rahasia (token DO, API key gateway, password SMTP, Turnstile) dienkripsi AES-256-GCM di database; UI admin hanya menerima nilai tersamarkan/flag boolean.
- Webhook: signature diverifikasi, nominal dicocokkan, pemrosesan idempoten.
- Rate limit untuk login, register, reset, tiket, dan aksi sensitif; audit log untuk aksi admin.
- Security headers di `next.config.ts`; bukti pembayaran disajikan lewat route terautentikasi, bukan folder publik.

**Checklist produksi:** HTTPS + reverse proxy, `APP_URL` benar, ganti `ADMIN_PASSWORD` setelah login pertama, batasi akses panel admin, backup `data/app.db` dan `data/wa-auth`, jalankan cron, dan pantau `/admin/logs`.

---

## 11. Verifikasi

```bash
npm run typecheck
npm run lint
npm run build
npm run smoke
```

Smoke test membuat pengguna sementara, memesan VPS, membayar dengan saldo, menjalankan provisioning mock, memeriksa IP/password terenkripsi, lalu membersihkan datanya. Script dijalankan dengan `--conditions=react-server` karena mengimpor modul `server-only`.

---

## 12. Troubleshooting

| Gejala | Penyebab umum |
| --- | --- |
| `better-sqlite3` gagal build | Toolchain C++ belum ada; pasang `build-essential python3` lalu `npm rebuild better-sqlite3` |
| Data tidak muncul setelah seed | Cek `DATABASE_URL`; `db:seed` idempoten dan tidak menimpa data yang sudah ada |
| Provisioning tidak jalan | Cron belum berjalan; jalankan `npm run cron:run` atau pasang scheduler |
| Pembayaran gateway tidak lunas | Cek signature, nominal, URL webhook, dan mode sandbox/production |
| WhatsApp tidak mengirim | Worker mati, `INTERNAL_SECRET` berbeda, atau sesi perlu pairing ulang di `/admin/whatsapp` |
| Secret tidak terbaca | `APP_ENCRYPTION_KEY` berubah/berbeda antar-deploy |

Dokumentasi keputusan arsitektur ada di [`DECISIONS.md`](./DECISIONS.md). Panduan deployment server ini ada di [`DEPLOY.md`](./DEPLOY.md).
