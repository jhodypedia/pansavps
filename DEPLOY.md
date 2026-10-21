# Deploy Produksi — cloud.hgitopup.web.id

Arsitektur: **Cloudflare (proxied/orange) → Nginx (TLS Let's Encrypt) → Next.js (127.0.0.1:3000) → SQLite**.

## Status server

| Komponen | Lokasi / perintah |
| --- | --- |
| Aplikasi | systemd `pansavps.service` |
| Cron tiap menit | `pansavps-cron.timer` → `pansavps-cron.service` |
| Worker WhatsApp | systemd `pansavps-wa.service` (127.0.0.1:3001) |
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

## Firewall

UFW aktif: hanya `22/tcp`, `80/tcp`, `443/tcp` yang terbuka. Aplikasi hanya listen di `127.0.0.1:3000`; worker WhatsApp hanya di `127.0.0.1:3001`.

```bash
ufw status verbose
```

## Backup

```bash
mkdir -p /var/backups/pansavps
sqlite3 /root/cloud/data/app.db ".backup '/var/backups/pansavps/app-$(date +%F).db'"
tar -czf /var/backups/pansavps/wa-auth-$(date +%F).tgz -C /root/cloud/data wa-auth
```

Simpan juga `/root/cloud/.env` (berisi `APP_ENCRYPTION_KEY`) secara aman. Tanpa kunci itu, rahasia di database tidak dapat didekripsi.

## Catatan

- `APP_URL=https://cloud.hgitopup.web.id` dan `NODE_ENV=production` sudah diatur di `.env`.
- Login admin memakai `ADMIN_EMAIL`/`ADMIN_PASSWORD` dari `.env`. Password database sudah diselaraskan dengan nilai `.env` saat deploy.
- Worker WhatsApp perlu pairing ulang melalui **Admin → WhatsApp** jika sesi `data/wa-auth` belum ada.
- Gateway Midtrans/Tripay perlu kredensial asli dan URL webhook:
  - `https://cloud.hgitopup.web.id/api/payments/midtrans/webhook`
  - `https://cloud.hgitopup.web.id/api/payments/tripay/webhook`
