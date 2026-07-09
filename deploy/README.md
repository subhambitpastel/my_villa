# Deploying MyVilla to GCP (Cloud SQL + Compute Engine VM)

MyVilla is a single Next.js app whose server actions talk **directly** to
Postgres. This deploys it as:

```
Internet ──▶ nginx (:80) ──▶ Next.js `next start` (:3000, systemd)
                                        │  DATABASE_URL=…@127.0.0.1:5432
                                        ▼
                              Cloud SQL Auth Proxy (:5432, systemd)
                                        │  (encrypted, IAM-authed)
                                        ▼
                              Cloud SQL — Postgres 16 (no public IP)
```

One always-on VM + one Cloud SQL instance. SQLite is gone; the app reads
`DATABASE_URL` from the environment (nothing is hardcoded).

## Prerequisites (on your machine)
- `gcloud` CLI installed and working, and a GCP **project with billing enabled**.
- `gcloud auth login` and `gcloud config set project YOUR_PROJECT`.

## Step 1 — Provision Cloud SQL + the VM
Edit the CONFIG block at the top of `deploy/provision.sh` (at least `PROJECT_ID`), then:

```bash
bash deploy/provision.sh
```

It prints **`DB_PASSWORD`**, **`CONNECTION_NAME`** (`project:region:instance`),
and the **VM public IP**. Copy them — you need them in Step 3.

## Step 2 — Get the app source onto the VM (`/opt/myvilla`)
**Option A — git (recommended, makes redeploys one command):**
```bash
# once, locally, if not already a repo:
git init && git add -A && git commit -m "MyVilla"
git remote add origin <your-repo-url> && git push -u origin main
# on the VM (after SSH in step 3):
sudo git clone <your-repo-url> /opt/myvilla
```
**Option B — copy straight to the VM (no repo):**
```bash
gcloud compute scp --recurse --zone=ZONE \
  --exclude=node_modules --exclude=.next --exclude=data --exclude=.git \
  . myvilla-vm:/tmp/myvilla
gcloud compute ssh myvilla-vm --zone=ZONE --command="sudo mv /tmp/myvilla /opt/myvilla"
```
> `.env.local`, `data/`, and `public/uploads/` are gitignored — the VM uses
> `/etc/myvilla.env` for config, so don't copy your local `.env.local`.

## Step 3 — Configure & start on the VM
```bash
gcloud compute ssh myvilla-vm --zone=ZONE
# then, on the VM (use the values from Step 1):
CONNECTION_NAME=project:region:instance DB_PASSWORD='the-password' \
  sudo -E bash /opt/myvilla/deploy/vm-setup.sh
```
This installs Node 22, the Cloud SQL Auth Proxy, builds the app, writes
`/etc/myvilla.env`, and starts three systemd services (`cloud-sql-proxy`,
`myvilla`, `nginx`). On first boot the app creates its schema automatically;
`SEED_DEMO=0` means **no demo accounts** are created — real users just register.

## Step 4 — Verify
```
open http://VM_PUBLIC_IP
# logs:
gcloud compute ssh myvilla-vm --zone=ZONE --command="journalctl -u myvilla -n 50 --no-pager"
```

## Redeploying after a code change
```bash
gcloud compute ssh myvilla-vm --zone=ZONE --command \
  "cd /opt/myvilla && sudo git pull && sudo npm ci && sudo npm run build && sudo systemctl restart myvilla"
```

## Notes
- **Uploaded images** (`public/uploads/`) live on the VM's disk and survive
  restarts and `git pull` redeploys (they're gitignored, so pull won't delete
  them). If you ever recreate the VM, snapshot the disk or move uploads to a
  GCS bucket first.
- **Backups**: Cloud SQL automated backups are on by default — verify with
  `gcloud sql instances describe myvilla-db`.
- **HTTPS / a domain**: point an A record at the VM IP, then on the VM run
  `sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx`.
  Afterwards set `APP_URL=https://your-domain` in `/etc/myvilla.env` and
  `sudo systemctl restart myvilla` (so password-reset links use https).
- **Cost** (rough): `db-custom-1-3840` Cloud SQL + an `e2-small` VM ≈ US$35–55/mo.
  For a demo, drop the DB tier to `db-f1-micro` (set `DB_TIER` in provision.sh).
- **Scaling past one VM**: a single Cloud SQL instance is fine for many
  instances later; to scale the app, put it behind a managed instance group +
  load balancer. Postgres already supports concurrent app instances (unlike the
  old SQLite).
