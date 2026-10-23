# Proteksi dasar origin PansaVPS.
# Cloudflare -> Nginx -> Next.js 127.0.0.1:__APP_PORT__

real_ip_header CF-Connecting-IP;
real_ip_recursive on;

# Batasi request per IP asli pengunjung (bukan IP edge Cloudflare).
limit_req_zone $binary_remote_addr zone=pansa_general:20m rate=20r/s;
limit_req_zone $binary_remote_addr zone=pansa_auth:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=pansa_api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=pansa_webhook:10m rate=20r/s;
limit_conn_zone $binary_remote_addr zone=pansa_conn:10m;

limit_req_status 429;
limit_conn_status 429;
limit_req_log_level warn;

client_body_timeout 15s;
client_header_timeout 15s;
send_timeout 30s;
keepalive_timeout 30s;
keepalive_requests 1000;
large_client_header_buffers 4 16k;
client_body_buffer_size 128k;

open_file_cache max=2000 inactive=60s;
open_file_cache_valid 30s;
open_file_cache_min_uses 2;
open_file_cache_errors off;

gzip_vary on;
gzip_proxied any;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_types
    text/plain
    text/css
    application/json
    application/javascript
    application/x-javascript
    text/xml
    application/xml
    application/xml+rss
    text/javascript
    image/svg+xml
    application/manifest+json;

upstream pansavps_next {
    server 127.0.0.1:__APP_PORT__;
    keepalive 32;
}
