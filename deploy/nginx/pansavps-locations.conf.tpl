client_max_body_size 8m;

__CLOUDFLARE_BLOCK__

location ^~ /.well-known/acme-challenge/ {
    root /var/www/html;
}

# File build Next.js dilayani langsung oleh Nginx, bukan Node.
location ^~ /_next/static/ {
    alias /var/www/pansavps/_next/static/;
    access_log off;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

# Jangan layani file tersembunyi dan path eksploit umum.
location ~ /\.(?!well-known) {
    deny all;
    access_log off;
}

location ~* ^/(wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|\.git|\.env) {
    return 444;
}

# Endpoint autentikasi: batasi lebih ketat.
location ~ ^/(login|register|forgot-password|reset-password|verifikasi-akun|verifikasi-email)/?$ {
    limit_req zone=pansa_auth burst=12 nodelay;
    limit_conn pansa_conn 10;
    include /etc/nginx/snippets/pansavps-proxy.conf;
}

# Callback Tripay tidak boleh dibatasi seketat halaman login.
location = /api/payments/tripay/webhook {
    limit_req zone=pansa_webhook burst=50 nodelay;
    limit_conn pansa_conn 20;
    include /etc/nginx/snippets/pansavps-proxy.conf;
}

# Cron internal tetap dilindungi, meskipun sudah memakai secret.
location = /api/cron {
    limit_req zone=pansa_auth burst=5 nodelay;
    limit_conn pansa_conn 5;
    include /etc/nginx/snippets/pansavps-proxy.conf;
}

location ^~ /api/ {
    limit_req zone=pansa_api burst=30 nodelay;
    limit_conn pansa_conn 20;
    include /etc/nginx/snippets/pansavps-proxy.conf;
}

location / {
    limit_req zone=pansa_general burst=60 nodelay;
    limit_conn pansa_conn 30;
    include /etc/nginx/snippets/pansavps-proxy.conf;
}
