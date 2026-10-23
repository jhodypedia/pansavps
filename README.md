# PansaVPS

Toko VPS DigitalOcean berbasis Next.js, Drizzle ORM, dan SQLite. Panduan ini hanya berisi instalasi, konfigurasi awal, dan operasional dasar.

## Prasyarat

- Node.js **≥ 20.9** (disarankan Node 22/24)
- npm 10+
- Build tools untuk `better-sqlite3`
  - Debian/Ubuntu: `sudo apt install -y build-essential python3`
- SQLite (tidak perlu server database terpisah)

## Instalasi

```bash
git clone <URL_REPOSITORY> pansavps
cd pansavps
npm install
cp .env.example .env
```

Buat kunci enkripsi:

```bash
openssl rand -hex 32
```

Isi `.env`:

```env
APP_URL=http://localhost:3000
NODE_ENV=development
DATABASE_URL=./data/app.db
APP_ENCRYPTION_KEY=<64 karakter hex dari openssl>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<password admin awal>
CRON_SECRET=<secret acak>
INTERNAL_SECRET=<secret acak>
WA_WORKER_URL=http://127.0.0.1:3001
```

> **Penting:** jangan mengganti `APP_ENCRYPTION_KEY` setelah database berisi data. Token DigitalOcean, API key pembayaran, dan password SMTP disimpan terenkripsi dengan kunci ini.

## Database & build

```bash
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

Buka `http://localhost:3000` lalu masuk dengan `ADMIN_EMAIL` dan `ADMIN_PASSWORD`. Simpan password yang dicetak `db:seed` jika `ADMIN_PASSWORD` kosong.

Untuk pengembangan:

```bash
npm run dev
```

## Instalasi produksi cepat

Untuk server Ubuntu baru (Nginx + systemd + HTTPS + proteksi dasar):

```bash
git clone https://github.com/jhodypedia/pansavps.git /root/cloud
cd /root/cloud
LETSENCRYPT_EMAIL=admin@example.com ./setup.sh
```

Migrasi dari server lama:

```bash
# Di server lama
cd /root/cloud
systemctl stop pansavps pansavps-wa
tar -czf /tmp/pansavps-backup.tgz .env data
systemctl start pansavps pansavps-wa

# Di server baru
RESTORE_ARCHIVE=/tmp/pansavps-backup.tgz \
LETSENCRYPT_EMAIL=admin@example.com \
./setup.sh
```

Panduan lengkap, opsi `CLOUDFLARE_ONLY`, dan catatan DNS Cloudflare ada di [`DEPLOY.md`](./DEPLOY.md).

## Setup awal di panel admin

Masuk ke **Admin → Pengaturan**.

### DigitalOcean (multi-akun)

1. Buka tab **DigitalOcean**.
2. Tambahkan satu atau lebih akun: isi nama dan personal access token, lalu simpan.
3. Tandai satu akun sebagai **default** dan pastikan statusnya **aktif**.
4. Gunakan **Uji koneksi** pada setiap akun.
5. Atur **Region default** dan matikan **Mode mock** untuk provisioning nyata.

Provisioning memakai akun default terlebih dahulu. Jika kapasitas droplet penuh atau token bermasalah, sistem otomatis mencoba akun aktif berikutnya.

### Cloudflare Turnstile

1. Buat widget Turnstile di dashboard Cloudflare.
2. Buka **Admin → Pengaturan → Umum**.
3. Isi **Site key** dan **Secret key**, lalu aktifkan **Turnstile**.
4. Simpan. Verifikasi akan muncul di halaman masuk, daftar, dan reset password.

Jika kunci belum lengkap, verifikasi dilewati agar pengguna tidak terkunci.

### Pembayaran, email, dan WhatsApp

- **Pembayaran:** atur transfer manual dan/atau Tripay di tab **Pembayaran**. Untuk Tripay, daftarkan callback:
  `https://domain-anda/api/payments/tripay/webhook`
- **Email:** isi host, port, user, dan password SMTP di tab **Email**.
- **WhatsApp:** jalankan worker, lalu hubungkan nomor lewat **Admin → WhatsApp**.

## Menjalankan worker & cron

Worker WhatsApp:

```bash
npm run wa:worker
```

Cron provisioning, invoice, pembayaran, dan WhatsApp:

```bash
npm run cron:run
```

Produksi disarankan memakai systemd timer/cron setiap menit:

```cron
* * * * * cd /path/ke/pansavps && /usr/bin/npm run cron:run >> /var/log/pansavps-cron.log 2>&1
```

Atau panggil endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://domain-anda/api/cron
```

## Perintah berguna

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` / `npm run start` | Build dan server produksi |
| `npm run typecheck` | Pemeriksaan TypeScript |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate migrasi dari schema |
| `npm run db:migrate` | Terapkan migrasi |
| `npm run db:seed` | Seed data awal (idempoten) |
| `npm run db:reset` | Hapus database lalu seed ulang |
| `npm run cron:run` | Jalankan cron sekali |
| `npm run wa:worker` | Worker WhatsApp |

## Update aplikasi

```bash
cd /path/ke/pansavps
git pull
npm install
npm run db:migrate
npm run build
systemctl restart pansavps
systemctl restart pansavps-wa
```

## Backup

```bash
mkdir -p /var/backups/pansavps
sqlite3 data/app.db ".backup '/var/backups/pansavps/app-$(date +%F).db'"
tar -czf /var/backups/pansavps/wa-auth-$(date +%F).tgz -C data wa-auth
```

Simpan `.env` dan `APP_ENCRYPTION_KEY` di tempat aman.

## Dokumentasi lain

- Deployment produksi: [`DEPLOY.md`](./DEPLOY.md)
- Keputusan arsitektur: [`DECISIONS.md`](./DECISIONS.md)
