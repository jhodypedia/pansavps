# Deploy Produksi — cloud.hgitopup.web.id

Arsitektur: **Cloudflare (proxied/orange) → Nginx (TLS Let's Encrypt) → Next.js (127.0.0.1:3000) → SQLite**.

## Instalasi server baru / migrasi

`setup.sh` memasang seluruh stack di Ubuntu 22.04/24.04: paket sistem, Node.js, swap, sysctl, aplikasi, database, systemd, Nginx, sertifikat, UFW, dan timer pembaruan IP Cloudflare.

### Server baru tanpa data lama

```bash
git clone https://github.com/jhodypedia/pansavps.git /root/cloud
cd /root/cloud
LETSENCRYPT_EMAIL=admin@example.com ./setup.sh
```

Jika hanya ingin mengunduh installer:

```bash
curl -fsSL https://raw.githubusercontent.com/jhodypedia/pansavps/main/setup.sh -o /root/setup.sh
chmod +x /root/setup.sh
LETSENCRYPT_EMAIL=admin@example.com /root/setup.sh
```

Saat DNS Cloudflare belum diarahkan ke server baru, gunakan `CLOUDFLARE_ONLY=0` agar penerbitan sertifikat dan pengecekan awal tidak terblokir:

```bash
CLOUDFLARE_ONLY=0 LETSENCRYPT_EMAIL=admin@example.com ./setup.sh
```

Setelah DNS proxied dan HTTPS aktif, kunci origin:

```bash
CLOUDFLARE_ONLY=1 ./setup.sh --skip-git --skip-build
```

### Migrasi dari server lama

Di server lama:

```bash
cd /root/cloud
systemctl stop pansavps pansavps-wa
tar -czf /tmp/pansavps-backup.tgz .env data
systemctl start pansavps pansavps-wa
```

Salin ke server baru, lalu jalankan:

```bash
scp /tmp/pansavps-backup.tgz root@IP-SERVER-BARU:/tmp/
cd /root/cloud
RESTORE_ARCHIVE=/tmp/pansavps-backup.tgz \
CLOUDFLARE_ONLY=0 \
LETSENCRYPT_EMAIL=admin@example.com \
./setup.sh
```

Arsip harus berisi `.env` dan `data/` di root arsip. Script mempertahankan `APP_ENCRYPTION_KEY` dari `.env` lama; jangan menggantinya jika database berisi rahasia terenkripsi. Backup database sebelum migrasi juga dibuat otomatis di `data/backups/`.

Setelah DNS dipindahkan ke IP server baru dan Cloudflare kembali **Proxied** + **Full (strict)**:

```bash
CLOUDFLARE_ONLY=1 ./setup.sh --skip-git --skip-build
```

> Jangan memakai `RESTORE_ARCHIVE` lagi setelah migrasi pertama karena akan menimpa database yang sedang berjalan.

### Opsi penting

| Opsi | Keterangan |
| --- | --- |
| `--domain DOMAIN` | Domain publik, default `cloud.hgitopup.web.id` |
| `--app-dir DIR` | Lokasi aplikasi, default `/root/cloud` |
| `--port PORT` | Port internal Next.js, default `3000` |
| `--email EMAIL` | Email Let's Encrypt |
| `--no-ssl` | Hanya HTTP, tanpa sertifikat |
| `--cloudflare-only` | Tolak akses langsung ke IP origin |
| `--allow-direct` | Izinkan akses langsung (untuk bootstrap) |
| `--restore FILE` | Restore `.env` + `data/` dari `.tar.gz` |
| `--seed` | Paksa seed meskipun database sudah ada |
| `--skip-git` | Jangan clone/pull |
| `--skip-build` | Jangan `npm ci`/build, hanya konfigurasi ulang |
| `--no-ufw` | Jangan ubah aturan UFW |

## Status server

| Komponen | Lokasi / perintah |
| --- | --- |
| Aplikasi | systemd `pansavps.service` |
| Cron tiap menit | `pansavps-cron.timer` → `pansavps-cron.service` |
| Worker WhatsApp | systemd `pansavps-wa.service` (127.0.0.1:3001) |
| Refresh IP Cloudflare | `pansavps-cloudflare-ips.timer` (mingguan) |
| Nginx | `/etc/nginx/sites-available/cloud.hgitopup.web.id` |
| Sertifikat | `/etc/letsencrypt/live/cloud.hgitopup.web.id/` |
| Database | `/root/cloud/data/app.db` |
| Log aplikasi | `journalctl -u pansavps -f` |
| Log Nginx | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |

## Perintah operasional

```bash
systemctl status pansavps pansavps-cron.timer pansavps-wa
systemctl restart pansavps
systemctl restart pansavps-wa
journalctl -u pansavps -n 100 --no-pager

# Deploy ulang setelah build
cd /root/cloud
npm run build
systemctl restart pansavps

# Cron manual
cd /root/cloud && npm run cron:run

# Perpanjang sertifikat (otomatis oleh certbot.timer)
certbot renew --dry-run
nginx -t && systemctl reload nginx
```

## Cloudflare

1. DNS `cloud.hgitopup.web.id` → A `146.190.90.200`, **Proxied (orange)**.
2. SSL/TLS → Overview → pilih **Full (strict)**. Origin memakai sertifikat Let's Encrypt yang valid, jadi jangan gunakan Flexible.
3. Disarankan aktifkan **Always Use HTTPS**, **Automatic HTTPS Rewrites**, dan min TLS 1.2.
4. Jangan aktifkan cache untuk halaman HTML/API; aplikasi sudah mengirim `Cache-Control: no-store` untuk halaman dinamis.

> Cloudflare saat ini sudah melayani HTTPS dengan baik. Pastikan mode SSL di dashboard benar-benar **Full (strict)** agar koneksi Cloudflare → origin juga terenkripsi dan tervalidasi.

Daftar IP edge Cloudflare dipakai Nginx untuk `real_ip` dan memblokir akses langsung ke origin. Perbarui manual bila perlu:

```bash
systemctl start pansavps-cloudflare-ips.service
systemctl list-timers pansavps-cloudflare-ips.timer
```

## Lapisan proteksi

- Cloudflare di depan origin; direct IP origin ditolak `444` bila `CLOUDFLARE_ONLY=1`.
- Nginx membatasi request per IP: halaman umum, login/register, API, dan webhook pembayaran memakai zona berbeda.
- Nginx membatasi koneksi simultan, ukuran body, timeout, serta memblokir path eksploit umum dan file tersembunyi.
- Aset `/_next/static/` dilayani langsung Nginx dengan cache immutable setahun.
- Next.js memakai `poweredByHeader: false`, `compress: false` (gzip di Nginx), dan header keamanan termasuk HSTS.
- SQLite memakai WAL, `busy_timeout`, cache/mmap terbatas, dan pembersihan rate-limit berkala agar tidak lock saat traffic tinggi.
- Swap 2 GB, `vm.swappiness=10`, dan `NODE_OPTIONS=--max-old-space-size=1536` mencegah OOM pada VPS kecil.

## Firewall

UFW aktif: hanya `22/tcp`, `80/tcp`, `443/tcp` yang terbuka. Aplikasi hanya listen di `127.0.0.1:3000`; worker WhatsApp hanya di `127.0.0.1:3001`.

```bash
ufw status verbose
```

## Backup

Backup lengkap untuk pindah server:

```bash
cd /root/cloud
systemctl stop pansavps pansavps-wa
tar -czf /tmp/pansavps-backup-$(date +%F).tgz .env data
systemctl start pansavps pansavps-wa
```

Backup database saja:

```bash
mkdir -p /var/backups/pansavps
sqlite3 /root/cloud/data/app.db ".backup '/var/backups/pansavps/app-$(date +%F).db'"
tar -czf /var/backups/pansavps/wa-auth-$(date +%F).tgz -C /root/cloud/data wa-auth
```

Simpan juga `/root/cloud/.env` (berisi `APP_ENCRYPTION_KEY`) secara aman. Tanpa kunci itu, rahasia di database tidak dapat didekripsi. File backup berisi kredensial; batasi permission dan jangan commit ke Git.

## Catatan

- `APP_URL=https://cloud.hgitopup.web.id` dan `NODE_ENV=production` sudah diatur di `.env`.
- Login admin memakai `ADMIN_EMAIL`/`ADMIN_PASSWORD` dari `.env`. Password database sudah diselaraskan dengan nilai `.env` saat deploy.
- Worker WhatsApp perlu pairing ulang melalui **Admin → WhatsApp** jika sesi `data/wa-auth` belum ada.
- Gateway Midtrans/Tripay perlu kredensial asli dan URL webhook:
  - `https://cloud.hgitopup.web.id/api/payments/midtrans/webhook`
  - `https://cloud.hgitopup.web.id/api/payments/tripay/webhook`
