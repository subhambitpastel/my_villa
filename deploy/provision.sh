#!/usr/bin/env bash
# Provision MyVilla on GCP: a Cloud SQL (Postgres 16) instance + a Compute
# Engine VM that will run the Next.js app and connect to Cloud SQL through the
# Cloud SQL Auth Proxy. Run this on YOUR machine after `gcloud auth login`.
#
#   1. Edit the CONFIG block below (at minimum PROJECT_ID).
#   2. bash deploy/provision.sh
#   3. Note the printed DB_PASSWORD + CONNECTION_NAME, then follow deploy/README.md.
set -euo pipefail

# ----------------------------- CONFIG -----------------------------
PROJECT_ID="${PROJECT_ID:-CHANGE-ME-your-gcp-project}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
INSTANCE="${INSTANCE:-myvilla-db}"          # Cloud SQL instance name
DB_NAME="${DB_NAME:-myvilla}"
DB_USER="${DB_USER:-myvilla}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)}"
DB_TIER="${DB_TIER:-db-custom-1-3840}"      # 1 vCPU / 3.75GB. Cheapest: db-f1-micro
VM="${VM:-myvilla-vm}"
VM_MACHINE="${VM_MACHINE:-e2-small}"        # 2 vCPU / 2GB — enough for `next start`
# ------------------------------------------------------------------

echo "==> Project: $PROJECT_ID  Region: $REGION  Zone: $ZONE"
gcloud config set project "$PROJECT_ID"

echo "==> Enabling required APIs (sqladmin, compute)…"
gcloud services enable sqladmin.googleapis.com compute.googleapis.com

echo "==> Creating Cloud SQL Postgres 16 instance '$INSTANCE' (a few minutes)…"
if ! gcloud sql instances describe "$INSTANCE" >/dev/null 2>&1; then
  gcloud sql instances create "$INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier="$DB_TIER" \
    --region="$REGION" \
    --storage-auto-increase \
    --availability-type=zonal
fi

echo "==> Creating database '$DB_NAME' and user '$DB_USER'…"
gcloud sql databases create "$DB_NAME" --instance="$INSTANCE" 2>/dev/null || echo "   (database already exists)"
gcloud sql users create "$DB_USER" --instance="$INSTANCE" --password="$DB_PASSWORD" 2>/dev/null \
  || gcloud sql users set-password "$DB_USER" --instance="$INSTANCE" --password="$DB_PASSWORD"

CONN=$(gcloud sql instances describe "$INSTANCE" --format='value(connectionName)')

echo "==> Creating VM '$VM' ($VM_MACHINE, Debian 12) with Cloud SQL access…"
if ! gcloud compute instances describe "$VM" --zone="$ZONE" >/dev/null 2>&1; then
  gcloud compute instances create "$VM" \
    --zone="$ZONE" \
    --machine-type="$VM_MACHINE" \
    --image-family=debian-12 --image-project=debian-cloud \
    --scopes=cloud-platform \
    --tags=http-server,https-server
fi

echo "==> Opening HTTP/HTTPS on the firewall…"
gcloud compute firewall-rules create myvilla-allow-web \
  --allow=tcp:80,tcp:443 --target-tags=http-server,https-server \
  --description="MyVilla web" 2>/dev/null || echo "   (firewall rule already exists)"

VM_IP=$(gcloud compute instances describe "$VM" --zone="$ZONE" \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)')

cat <<SUMMARY

============================================================
 PROVISIONING DONE — save these, you need them next:
============================================================
  DB_PASSWORD      = $DB_PASSWORD
  CONNECTION_NAME  = $CONN
  VM               = $VM   (zone $ZONE)
  VM_PUBLIC_IP     = $VM_IP

 NEXT (see deploy/README.md):
  1. Get the app onto the VM (git clone, or: gcloud compute scp).
  2. SSH in:   gcloud compute ssh $VM --zone=$ZONE
  3. On the VM, run vm-setup.sh with:
       CONNECTION_NAME=$CONN DB_PASSWORD=$DB_PASSWORD sudo -E bash deploy/vm-setup.sh
  4. Open:     http://$VM_IP
============================================================
SUMMARY
