#!/usr/bin/env bash
# Perbarui daftar IP edge Cloudflare untuk real_ip + pembatasan origin.
# Aman dijalankan berulang; jika fetch/generate gagal, konfigurasi lama
# dipertahankan.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Jalankan sebagai root." >&2
  exit 1
fi

TARGET="/etc/nginx/conf.d/pansavps-cloudflare.conf"
BACKUP="${TARGET}.bak"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

V4="$(curl --fail --silent --show-error --max-time 20 https://www.cloudflare.com/ips-v4)"
V6="$(curl --fail --silent --show-error --max-time 20 https://www.cloudflare.com/ips-v6)"

if [[ -z "$V4" || -z "$V6" ]]; then
  echo "Daftar IP Cloudflare kosong; konfigurasi lama dipertahankan." >&2
  exit 1
fi

for cidr in $V4 $V6; do
  if [[ ! "$cidr" =~ ^[0-9a-fA-F:.]+/[0-9]+$ ]]; then
    echo "CIDR tidak valid dari Cloudflare: $cidr" >&2
    exit 1
  fi
done

{
  echo "# Cloudflare edge ranges — dibuat otomatis dari https://www.cloudflare.com/ips/"
  echo "# Jangan edit manual; jalankan pansavps-update-cloudflare-ips."
  echo
  for cidr in $V4 $V6; do
    echo "set_real_ip_from ${cidr};"
  done
  echo
  echo "# \$realip_remote_addr = peer asli (edge Cloudflare)."
  echo "# \$remote_addr = IP pengunjung dari CF-Connecting-IP."
  echo "geo \$realip_remote_addr \$pansa_from_cloudflare {"
  echo "    default 0;"
  echo "    127.0.0.1/32 1;"
  echo "    ::1/128 1;"
  for cidr in $V4 $V6; do
    echo "    ${cidr} 1;"
  done
  echo "}"
} >"$TMP"

if [[ -f "$TARGET" ]]; then
  cp -a "$TARGET" "$BACKUP"
fi

install -m 0644 "$TMP" "$TARGET"

if ! nginx -t >/dev/null 2>&1; then
  echo "Konfigurasi Nginx tidak valid; mengembalikan file lama." >&2
  if [[ -f "$BACKUP" ]]; then
    mv "$BACKUP" "$TARGET"
    nginx -t
  fi
  exit 1
fi

systemctl reload nginx
echo "Daftar IP Cloudflare diperbarui."
