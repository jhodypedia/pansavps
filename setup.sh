#!/usr/bin/env bash
#
# PansaVPS installer / server migration helper.
#
# Contoh pemakaian di server baru (Ubuntu 22.04/24.04, root):
#   curl -fsSL https://raw.githubusercontent.com/jhodypedia/pansavps/main/setup.sh -o setup.sh
#   chmod +x setup.sh
#   LETSENCRYPT_EMAIL=admin@example.com ./setup.sh
#
# Migrasi dari server lama:
#   1. Di server lama: tar -czf /tmp/pansavps-backup.tgz .env data
#   2. scp /tmp/pansavps-backup.tgz root@server-baru:/tmp/
#   3. Di server baru:
#      RESTORE_ARCHIVE=/tmp/pansavps-backup.tgz \
#      LETSENCRYPT_EMAIL=admin@example.com ./setup.sh
#
# Untuk sementara sebelum DNS Cloudflare dipindahkan, gunakan:
#   CLOUDFLARE_ONLY=0 ./setup.sh
# Setelah DNS proxied dan HTTPS aktif, jalankan ulang dengan CLOUDFLARE_ONLY=1.
#
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR"

DOMAIN="${DOMAIN:-cloud.hgitopup.web.id}"
APP_DIR="${APP_DIR:-/root/cloud}"
REPO_URL="${REPO_URL:-https://github.com/jhodypedia/pansavps.git}"
BRANCH="${BRANCH:-main}"
APP_PORT="${APP_PORT:-3000}"
APP_USER="${APP_USER:-root}"
SSL="${SSL:-1}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
CLOUDFLARE_ONLY="${CLOUDFLARE_ONLY:-1}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
RESTORE_ARCHIVE="${RESTORE_ARCHIVE:-}"
SEED="${SEED:-auto}"
SKIP_GIT="${SKIP_GIT:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
CONFIGURE_UFW="${CONFIGURE_UFW:-1}"
NODE_MAJOR="${NODE_MAJOR:-24}"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m[PERINGATAN] %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m[GAGAL] %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
PansaVPS setup.sh

Opsi:
  --domain DOMAIN          Domain publik (default: cloud.hgitopup.web.id)
  --app-dir DIR            Lokasi aplikasi (default: /root/cloud)
  --repo URL               Repo Git (default: GitHub PansaVPS)
  --branch BRANCH          Branch Git (default: main)
  --port PORT              Port internal Next.js (default: 3000)
  --email EMAIL            Email Let's Encrypt
  --no-ssl                 Jangan pasang/aktifkan HTTPS
  --cloudflare-only        Tolak akses langsung ke IP origin (default)
  --allow-direct           Izinkan akses langsung ke origin
  --restore FILE           Ekstrak backup .tar.gz berisi .env dan data/
  --seed                   Jalankan seed meskipun database sudah ada
  --skip-git               Jangan clone/pull
  --skip-build             Jangan npm ci / npm run build
  --no-ufw                 Jangan ubah aturan UFW
  -h, --help               Bantuan

Variabel lingkungan yang sering dipakai:
  APP_USER, NODE_MAJOR, SWAP_SIZE, SEED, CLOUDFLARE_ONLY,
  LETSENCRYPT_EMAIL, RESTORE_ARCHIVE
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:?}"; shift 2 ;;
    --app-dir) APP_DIR="${2:?}"; shift 2 ;;
    --repo) REPO_URL="${2:?}"; shift 2 ;;
    --branch) BRANCH="${2:?}"; shift 2 ;;
    --port) APP_PORT="${2:?}"; shift 2 ;;
    --email) LETSENCRYPT_EMAIL="${2:?}"; shift 2 ;;
    --no-ssl) SSL=0; shift ;;
    --cloudflare-only) CLOUDFLARE_ONLY=1; shift ;;
    --allow-direct) CLOUDFLARE_ONLY=0; shift ;;
    --restore) RESTORE_ARCHIVE="${2:?}"; shift 2 ;;
    --seed) SEED=1; shift ;;
    --skip-git) SKIP_GIT=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --no-ufw) CONFIGURE_UFW=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Opsi tidak dikenal: $1" ;;
  esac
done

[[ "${EUID}" -eq 0 ]] || die "Jalankan installer sebagai root."
[[ -n "$DOMAIN" ]] || die "DOMAIN tidak boleh kosong."
[[ "$DOMAIN" != http://* && "$DOMAIN" != https://* && "$DOMAIN" != */* ]] || die "DOMAIN hanya nama host, tanpa https:// atau path."
[[ "$APP_PORT" =~ ^[0-9]+$ ]] || die "APP_PORT harus angka."
[[ "$APP_PORT" -ge 1 && "$APP_PORT" -le 65535 ]] || die "APP_PORT harus 1-65535."
[[ "$APP_DIR" == /* ]] || die "APP_DIR harus path absolut."
[[ "$APP_DIR" != "/" ]] || die "APP_DIR tidak boleh /."
[[ "$SSL" == "0" || "$SSL" == "1" ]] || die "SSL harus 0 atau 1."
[[ "$CLOUDFLARE_ONLY" == "0" || "$CLOUDFLARE_ONLY" == "1" ]] || die "CLOUDFLARE_ONLY harus 0 atau 1."
if [[ "$SSL" == "1" && ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" && -z "$LETSENCRYPT_EMAIL" ]]; then
  die "LETSENCRYPT_EMAIL wajib diisi untuk penerbitan sertifikat pertama. Atau gunakan --no-ssl."
fi
if [[ "$APP_USER" != "root" ]]; then
  id "$APP_USER" >/dev/null 2>&1 || die "User $APP_USER tidak ada. Buat dulu atau gunakan APP_USER=root."
  if [[ "$APP_DIR" == /root/* ]]; then
    die "User non-root tidak bisa memakai APP_DIR di /root. Gunakan APP_USER=root atau APP_DIR=/opt/pansavps."
  fi
fi
if [[ -n "$RESTORE_ARCHIVE" ]]; then
  if [[ "$RESTORE_ARCHIVE" != /* ]]; then
    RESTORE_ARCHIVE="$(cd -- "$(dirname -- "$RESTORE_ARCHIVE")" && pwd)/$(basename -- "$RESTORE_ARCHIVE")"
  fi
  [[ -f "$RESTORE_ARCHIVE" ]] || die "File restore tidak ditemukan: $RESTORE_ARCHIVE"
fi

export DEBIAN_FRONTEND=noninteractive

log "Memasang paket sistem"
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl git rsync nginx certbot python3-certbot-nginx \
  sqlite3 openssl build-essential ufw tar gzip

log "Menyiapkan swap dan sysctl"
if [[ ! -f /swapfile ]]; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
fi
if ! grep -q '^/swapfile ' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon /swapfile 2>/dev/null || true

log "Menentukan Node.js"
node_version_ok() {
  "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=9)?0:1)' >/dev/null 2>&1
}

NODE_EXEC=""
if command -v node >/dev/null 2>&1 && node_version_ok "$(command -v node)"; then
  NODE_EXEC="$(command -v node)"
elif compgen -G "/root/.nvm/versions/node/v*/bin/node" >/dev/null; then
  NODE_EXEC="$(ls -d /root/.nvm/versions/node/v*/bin/node | sort -V | tail -1)"
else
  log "Memasang Node.js ${NODE_MAJOR}.x dari NodeSource"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh
  apt-get install -y --no-install-recommends nodejs
  NODE_EXEC="$(command -v node)"
fi
node_version_ok "$NODE_EXEC" || die "Node.js minimal 20.9 wajib tersedia."
NPM_EXEC="$(dirname "$NODE_EXEC")/npm"
[[ -x "$NPM_EXEC" ]] || NPM_EXEC="$(command -v npm)"
[[ -x "$NPM_EXEC" ]] || die "npm tidak ditemukan."
log "Node: $($NODE_EXEC --version) — $NODE_EXEC"

log "Menyiapkan direktori aplikasi"
mkdir -p "$APP_DIR"
if [[ -d "$APP_DIR/.git" && "$SKIP_GIT" != "1" ]]; then
  log "Memperbarui source dari Git"
  git -C "$APP_DIR" fetch --prune origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
elif [[ ! -f "$APP_DIR/package.json" ]]; then
  [[ "$SKIP_GIT" != "1" ]] || die "$APP_DIR tidak berisi aplikasi. Hapus --skip-git atau clone manual."
  [[ -z "$(ls -A "$APP_DIR" 2>/dev/null)" ]] || die "Direktori $APP_DIR tidak kosong dan bukan repo Git. Kosongkan dulu atau gunakan --skip-git."
  log "Meng-clone aplikasi"
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi
[[ -f "$APP_DIR/package.json" ]] || die "package.json tidak ditemukan di $APP_DIR."

cd "$APP_DIR"

if [[ ! -d "$SRC_DIR/deploy" ]]; then
  SRC_DIR="$APP_DIR"
fi
[[ -d "$SRC_DIR/deploy" ]] || die "Folder deploy/ tidak ditemukan. Jalankan setup.sh dari repo atau clone repo terlebih dahulu."

install -m 0644 "$SRC_DIR/deploy/sysctl/99-pansavps.conf" /etc/sysctl.d/99-pansavps.conf
sysctl --system >/dev/null

if [[ -n "$RESTORE_ARCHIVE" ]]; then
  log "Memulihkan backup: $RESTORE_ARCHIVE"
  tar -xzf "$RESTORE_ARCHIVE" -C "$APP_DIR"
fi

log "Menyiapkan .env"
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$APP_DIR/.env.example" "$ENV_FILE"
  warn ".env baru dibuat. Jika memulihkan database lama, APP_ENCRYPTION_KEY harus sama dengan server lama."
fi

ensure_env() {
  local key="$1"
  local value="$2"
  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = path.read_text(encoding="utf-8").splitlines()
for i, line in enumerate(lines):
    if line.startswith(f"{key}="):
        lines[i] = f"{key}={value}"
        break
else:
    lines.append(f"{key}={value}")
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
}
get_env() {
  sed -n "s/^${1}=//p" "$ENV_FILE" | tail -1 | sed -e 's/^"//' -e 's/"$//'
}

ensure_env NODE_ENV production
ensure_env DATABASE_URL "./data/app.db"
if [[ "$SSL" == "1" ]]; then
  ensure_env APP_URL "https://$DOMAIN"
else
  ensure_env APP_URL "http://$DOMAIN"
fi
ensure_env WA_WORKER_URL "http://127.0.0.1:3001"

if [[ -z "$(get_env APP_ENCRYPTION_KEY)" || "$(get_env APP_ENCRYPTION_KEY)" == ganti-* ]]; then
  ensure_env APP_ENCRYPTION_KEY "$(openssl rand -hex 32)"
fi
if [[ -z "$(get_env CRON_SECRET)" || "$(get_env CRON_SECRET)" == buat-* ]]; then
  ensure_env CRON_SECRET "$(openssl rand -hex 32)"
fi
if [[ -z "$(get_env INTERNAL_SECRET)" || "$(get_env INTERNAL_SECRET)" == buat-* ]]; then
  ensure_env INTERNAL_SECRET "$(openssl rand -hex 32)"
fi
if [[ -n "${ADMIN_EMAIL:-}" ]]; then ensure_env ADMIN_EMAIL "$ADMIN_EMAIL"; fi
if [[ -n "${ADMIN_PASSWORD:-}" ]]; then ensure_env ADMIN_PASSWORD "$ADMIN_PASSWORD"; fi
chmod 600 "$ENV_FILE"

log "Menyiapkan database"
mkdir -p "$APP_DIR/data/uploads" "$APP_DIR/data/backups" "$APP_DIR/data/wa-auth"
FRESH_DB=0
if [[ ! -f "$APP_DIR/data/app.db" ]]; then
  FRESH_DB=1
else
  BACKUP_DB="$APP_DIR/data/backups/pre-setup-$(date +%Y%m%d-%H%M%S).db"
  sqlite3 "$APP_DIR/data/app.db" ".backup '$BACKUP_DB'" || cp "$APP_DIR/data/app.db" "$BACKUP_DB"
  log "Backup database: $BACKUP_DB"
fi

log "Menghentikan service aplikasi sementara"
systemctl stop pansavps pansavps-wa 2>/dev/null || true

log "Memasang dependency"
if [[ "$SKIP_BUILD" != "1" ]]; then
  if [[ -f "$APP_DIR/package-lock.json" ]]; then
    "$NPM_EXEC" ci --no-audit --no-fund
  else
    "$NPM_EXEC" install --no-audit --no-fund
  fi
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  log "Build Next.js"
  "$NPM_EXEC" run build
fi
[[ -f "$APP_DIR/.next/BUILD_ID" ]] || die "Build .next tidak ditemukan. Jalankan tanpa --skip-build."

log "Menjalankan migrasi database"
DB_URL="$(get_env DATABASE_URL)"
DATABASE_URL="${DB_URL:-./data/app.db}" "$NPM_EXEC" run db:migrate
if [[ "$SEED" == "1" || ( "$SEED" == "auto" && "$FRESH_DB" == "1" ) ]]; then
  "$NPM_EXEC" run db:seed
fi

log "Menyiapkan systemd"
render_template() {
  local src="$1"
  local dst="$2"
  sed \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__NODE_BIN__|$NODE_EXEC|g" \
    -e "s|__NPM_BIN__|$NPM_EXEC|g" \
    -e "s|__APP_PORT__|$APP_PORT|g" \
    -e "s|__APP_USER__|$APP_USER|g" \
    "$src" > "$dst"
}

render_template "$SRC_DIR/deploy/systemd/pansavps.service.tpl" /etc/systemd/system/pansavps.service
render_template "$SRC_DIR/deploy/systemd/pansavps-cron.service.tpl" /etc/systemd/system/pansavps-cron.service
render_template "$SRC_DIR/deploy/systemd/pansavps-wa.service.tpl" /etc/systemd/system/pansavps-wa.service
install -m 0644 "$SRC_DIR/deploy/systemd/pansavps-cron.timer" /etc/systemd/system/pansavps-cron.timer
install -m 0644 "$SRC_DIR/deploy/systemd/pansavps-cloudflare-ips.service" /etc/systemd/system/pansavps-cloudflare-ips.service
install -m 0644 "$SRC_DIR/deploy/systemd/pansavps-cloudflare-ips.timer" /etc/systemd/system/pansavps-cloudflare-ips.timer
install -m 0755 "$SRC_DIR/deploy/scripts/update-cloudflare-ips.sh" /usr/local/sbin/pansavps-update-cloudflare-ips

if [[ "$APP_USER" != "root" ]]; then
  chown -R "$APP_USER:$APP_USER" "$APP_DIR/data" "$APP_DIR/.next" "$ENV_FILE"
fi

mkdir -p /var/www/pansavps/_next/static
rsync -a --delete "$APP_DIR/.next/static/" /var/www/pansavps/_next/static/

systemctl daemon-reload
systemctl enable pansavps pansavps-wa pansavps-cron.timer pansavps-cloudflare-ips.timer
systemctl restart pansavps
systemctl restart pansavps-wa
systemctl start pansavps-cron.timer
systemctl start pansavps-cloudflare-ips.timer || true

log "Menyiapkan Nginx"
install -d /etc/nginx/snippets /etc/nginx/conf.d /etc/nginx/sites-available /etc/nginx/sites-enabled
install -m 0644 "$SRC_DIR/deploy/nginx/nginx.conf" /etc/nginx/nginx.conf
install -m 0644 "$SRC_DIR/deploy/nginx/pansavps-proxy.conf" /etc/nginx/snippets/pansavps-proxy.conf
install -m 0644 "$SRC_DIR/deploy/nginx/pansavps-ssl.conf" /etc/nginx/snippets/pansavps-ssl.conf
install -m 0644 "$SRC_DIR/deploy/nginx/pansavps-cloudflare.conf" /etc/nginx/conf.d/pansavps-cloudflare.conf
sed "s|__APP_PORT__|$APP_PORT|g" "$SRC_DIR/deploy/nginx/pansavps-security.conf.tpl" \
  > /etc/nginx/conf.d/pansavps-security.conf

if [[ "$CLOUDFLARE_ONLY" == "1" ]]; then
  CF_BLOCK='if ($pansa_from_cloudflare = 0) { return 444; }'
else
  CF_BLOCK='# Akses langsung ke origin diizinkan (CLOUDFLARE_ONLY=0).'
fi
sed "s|__CLOUDFLARE_BLOCK__|$CF_BLOCK|" "$SRC_DIR/deploy/nginx/pansavps-locations.conf.tpl" \
  > /etc/nginx/snippets/pansavps-locations.conf

SITE_FILE="/etc/nginx/sites-available/$DOMAIN"
if [[ "$SSL" == "1" && ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  log "Menerbitkan sertifikat Let's Encrypt"
  mkdir -p /var/www/html
  cat > "$SITE_FILE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 503;
    }
}
EOF
  ln -sf "$SITE_FILE" "/etc/nginx/sites-enabled/$DOMAIN"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx

  if ! certbot certonly --webroot -w /var/www/html -d "$DOMAIN" \
    --non-interactive --agree-tos --email "$LETSENCRYPT_EMAIL" --keep-until-expiring; then
    warn "Penerbitan sertifikat gagal. Jika Cloudflare proxied/Always HTTPS aktif,"
    warn "ubah DNS ke DNS-only sementara atau matikan Always Use HTTPS, lalu ulangi."
    die "Sertifikat belum terbit."
  fi
fi

if [[ "$SSL" == "1" ]]; then
  sed "s|__DOMAIN__|$DOMAIN|g" "$SRC_DIR/deploy/nginx/site-ssl.conf.tpl" > "$SITE_FILE"
else
  sed "s|__DOMAIN__|$DOMAIN|g" "$SRC_DIR/deploy/nginx/site-http.conf.tpl" > "$SITE_FILE"
fi
ln -sf "$SITE_FILE" "/etc/nginx/sites-enabled/$DOMAIN"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "Memperbarui daftar IP Cloudflare"
systemctl start pansavps-cloudflare-ips.service || warn "Pembaruan IP Cloudflare gagal; daftar bawaan tetap dipakai."

install -d /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
nginx -t && systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

log "Menyiapkan firewall"
if [[ "$CONFIGURE_UFW" == "1" ]]; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
else
  warn "UFW tidak diubah (--no-ufw)."
fi

log "Verifikasi"
sleep 2
systemctl is-active --quiet pansavps || die "Service pansavps gagal berjalan. Cek: journalctl -u pansavps -n 100"
if [[ "$SSL" == "1" ]]; then
  curl -fsS -k --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" >/dev/null \
    || warn "Aplikasi merespons, tetapi cek manual https://$DOMAIN/."
else
  curl -fsS --max-time 10 -H "Host: $DOMAIN" "http://127.0.0.1/" >/dev/null \
    || warn "Aplikasi merespons, tetapi cek manual http://$DOMAIN/."
fi

if [[ "$SSL" == "1" ]]; then
  SSL_SCHEME="https"
else
  SSL_SCHEME="http"
fi

cat <<EOF

============================================================
 PansaVPS selesai dipasang
============================================================
 URL          : $SSL_SCHEME://$DOMAIN
 App dir      : $APP_DIR
 Node         : $NODE_EXEC
 Service      : pansavps.service
 Cron         : pansavps-cron.timer
 WhatsApp     : pansavps-wa.service
 Nginx        : /etc/nginx/sites-available/$DOMAIN
 Cloudflare   : CLOUDFLARE_ONLY=$CLOUDFLARE_ONLY
 Log aplikasi : journalctl -u pansavps -f
 Log Nginx    : /var/log/nginx/error.log

 Catatan:
 - Jika baru memulihkan database lama, pastikan APP_ENCRYPTION_KEY di
   $ENV_FILE sama dengan server lama.
 - WhatsApp perlu pairing ulang lewat Admin -> WhatsApp jika data/wa-auth
   belum dipulihkan.
 - Backup database sebelum migrasi ada di $APP_DIR/data/backups/.
============================================================

EOF
