#!/usr/bin/env bash
set -euo pipefail

# Config (override via env)
PROJECT="${PROJECT:-viewpers}"
REGION="${REGION:-asia-northeast1}"
LOCATION="${LOCATION:-asia-northeast1}"
STAGING="${STAGING:-gs://viewpers-dataflow-staging/staging}"
TEMP="${TEMP:-gs://viewpers-dataflow-temp/temp}"
OUT_BUCKET_PREFIX="${OUT_BUCKET_PREFIX:-gs://salesguarddata/ndjson/normalized}"
ZIP_PREFIX="${ZIP_PREFIX:-gs://salesguarddata/salesguarddata/*.zip}"
AR_REPO="${AR_REPO:-df-templates}"
AR_LOCATION="${AR_LOCATION:-asia-northeast1}"
BQ_DATASET="${BQ_DATASET:-salesguard_alerts}"

log() { echo "[preflight] $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing command: $1"; exit 1; }
}

log "checking required commands"
require_cmd gcloud
require_cmd gsutil
require_cmd bq

log "setting gcloud project/region"
gcloud config set project "$PROJECT" >/dev/null
gcloud config set dataflow/region "$REGION" >/dev/null || true

log "enabling required APIs (idempotent)"
gcloud services enable \
  dataflow.googleapis.com \
  compute.googleapis.com \
  storage.googleapis.com \
  bigquery.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  --project="$PROJECT" >/dev/null

log "verifying buckets and prefixes"
for p in "$STAGING" "$TEMP" "$OUT_BUCKET_PREFIX"; do
  if [[ "$p" != gs://* ]]; then echo "invalid GCS path: $p"; exit 1; fi
  bucket="${p#gs://}"
  bucket="${bucket%%/*}"
  if ! gsutil ls -b "gs://$bucket" >/dev/null 2>&1; then
    echo "bucket not found: gs://$bucket"; exit 1
  fi
  # ensure subpath exists by creating a zero-byte marker
  if ! gsutil -q stat "$p/.preflight" 2>/dev/null; then
    echo "ok" | gsutil cp - "$p/.preflight" >/dev/null || true
  fi
done

log "verifying ZIP input prefix visibility"
# Only list a few to avoid large output; avoid failing due to pipe SIGPIPE from head
if ! gsutil ls -l "${ZIP_PREFIX}" >/dev/null 2>&1; then
  echo "cannot list ZIP prefix: ${ZIP_PREFIX}"; exit 1;
else
  gsutil ls -l "${ZIP_PREFIX}" | head -n 5 >/dev/null 2>&1 || true
fi

log "verifying BigQuery dataset"
if ! bq --project_id="$PROJECT" --location="$LOCATION" ls -d "$BQ_DATASET" >/dev/null 2>&1; then
  log "creating dataset $BQ_DATASET in $LOCATION"
  bq --project_id="$PROJECT" --location="$LOCATION" mk -d "$BQ_DATASET" >/dev/null
fi

log "verifying Artifact Registry repo"
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$AR_LOCATION" --project="$PROJECT" >/dev/null 2>&1; then
  log "creating AR repo $AR_REPO in $AR_LOCATION"
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$AR_LOCATION" \
    --project="$PROJECT" >/dev/null
fi

log "preflight OK: project=$PROJECT region=$REGION dataset=$BQ_DATASET" 