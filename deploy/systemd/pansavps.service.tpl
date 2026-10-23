[Unit]
Description=PansaVPS Next.js application
After=network.target

[Service]
Type=simple
WorkingDirectory=__APP_DIR__
EnvironmentFile=-__APP_DIR__/.env
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=1536
ExecStartPre=+/bin/mkdir -p /var/www/pansavps/_next/static
ExecStartPre=+/usr/bin/rsync -a --delete __APP_DIR__/.next/static/ /var/www/pansavps/_next/static/
ExecStart=__NODE_BIN__ __APP_DIR__/node_modules/next/dist/bin/next start -H 127.0.0.1 -p __APP_PORT__
Restart=always
RestartSec=5
LimitNOFILE=65535
KillSignal=SIGTERM
TimeoutStopSec=30
User=__APP_USER__

[Install]
WantedBy=multi-user.target
