[Unit]
Description=PansaVPS WhatsApp worker (Baileys)
After=network.target

[Service]
Type=simple
WorkingDirectory=__APP_DIR__
EnvironmentFile=-__APP_DIR__/.env
User=__APP_USER__
ExecStart=__NPM_BIN__ run wa:worker
Restart=always
RestartSec=10
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
