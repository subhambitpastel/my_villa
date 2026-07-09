#!/usr/bin/env bash
# Runs ON the Compute Engine VM (Debian 12). Installs Node 22, the Cloud SQL
# Auth Proxy, builds the app, and starts everything under systemd behind nginx.
#
# Requires the app source already present at /opt/myvilla (git clone or scp).
# Pass the values printed by provision.sh:
#   CONNECTION_NAME=<proj:region:instance> DB_PASSWORD=<pw> sudo -E bash deploy/vm-setup.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/myvilla}"
DB_NAME="${DB_NAME:-myvilla}"
DB_USER="${DB_USER:-myvilla}"
: "${CONNECTION_NAME:?set CONNECTION_NAME=proj:region:instance}"
: "${DB_PASSWORD:?set DB_PASSWORD=...}"

if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: app source not found at $APP_DIR. Copy it there first (see README)."; exit 1
fi

echo "==> Installing Node 22 + nginx…"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs nginx

echo "==> Installing the Cloud SQL Auth Proxy…"
curl -o /usr/local/bin/cloud-sql-proxy \
  https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.linux.amd64
chmod +x /usr/local/bin/cloud-sql-proxy

echo "==> Writing app environment (/etc/myvilla.env)…"
VM_IP="$(curl -s -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || echo localhost)"
cat > /etc/myvilla.env <<ENV
NODE_ENV=production
PORT=3000
# App connects to the Auth Proxy on localhost — the DB has no public IP.
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}
APP_URL=http://${VM_IP}
# Never seed demo accounts in production:
SEED_DEMO=0
ENV
chmod 600 /etc/myvilla.env

echo "==> systemd: Cloud SQL Auth Proxy service…"
cat > /etc/systemd/system/cloud-sql-proxy.service <<UNIT
[Unit]
Description=Cloud SQL Auth Proxy
After=network.target
[Service]
ExecStart=/usr/local/bin/cloud-sql-proxy --address 127.0.0.1 --port 5432 ${CONNECTION_NAME}
Restart=always
[Install]
WantedBy=multi-user.target
UNIT

echo "==> Building the app…"
cd "$APP_DIR"
npm ci
npm run build

echo "==> systemd: MyVilla app service…"
cat > /etc/systemd/system/myvilla.service <<UNIT
[Unit]
Description=MyVilla (Next.js)
After=network.target cloud-sql-proxy.service
Requires=cloud-sql-proxy.service
[Service]
WorkingDirectory=${APP_DIR}
EnvironmentFile=/etc/myvilla.env
ExecStart=/usr/bin/npm run start
Restart=always
User=root
[Install]
WantedBy=multi-user.target
UNIT

echo "==> nginx reverse proxy (:80 -> :3000)…"
cat > /etc/nginx/sites-available/myvilla <<'NGINX'
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 15m;   # villa/avatar image uploads
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/myvilla /etc/nginx/sites-enabled/myvilla
rm -f /etc/nginx/sites-enabled/default

echo "==> Starting services…"
systemctl daemon-reload
systemctl enable --now cloud-sql-proxy.service
sleep 3
systemctl enable --now myvilla.service
nginx -t && systemctl restart nginx

echo ""
echo "DONE. App: http://${VM_IP}"
echo "Logs:  journalctl -u myvilla -f   |   journalctl -u cloud-sql-proxy -f"
