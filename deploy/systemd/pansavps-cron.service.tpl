[Unit]
Description=PansaVPS cron job
After=network.target

[Service]
Type=oneshot
WorkingDirectory=__APP_DIR__
EnvironmentFile=-__APP_DIR__/.env
User=__APP_USER__
ExecStart=__NPM_BIN__ run cron:run
