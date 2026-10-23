server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;

    include /etc/nginx/snippets/pansavps-locations.conf;
}
