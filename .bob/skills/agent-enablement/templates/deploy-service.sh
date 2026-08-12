#!/usr/bin/env bash
#
# deploy-service.sh — publish a modernized service to the managed container
# platform so an assistant channel can reach it.
#
#   ./deploy-service.sh <app-name> <service-dir> <port> [tag]
#
#   ./deploy-service.sh meridian-ap-api reference/modern-api 8080
#   ./deploy-service.sh meridian-ap-api reference/modern-api 8080 v7
#
# What it does, in order: verify the cloud session is pointed at the right
# account, build a linux/amd64 image, push it to the private registry, then
# create the application or update it in place, and print the URL it is served
# on.
#
# Idempotent. Running it twice with the same arguments produces the same
# application at the same URL, carrying whichever image was built last.
#
# Image tags
# ----------
# The tag is the service's git short SHA, so an image is traceable to the commit
# it was built from. Pass a fourth argument to override it — use that when the
# working tree is dirty and two builds would otherwise collide on one tag. If
# the directory is not under version control the script falls back to an
# incrementing counter kept in <service-dir>/.ce-build.
#
# The tag is never derived from the clock. A wall-clock tag cannot be traced to
# a commit, cannot be reproduced, and makes two builds of the same code look
# like two different releases in the registry.
#
# Environment passthrough
# -----------------------
# If <service-dir>/.ce-env exists, each KEY=VALUE line in it is passed to the
# application as an environment variable. Blank lines and # comments are
# ignored. This is how the service receives its Vault address, its own Vault
# token and the governance ingest settings. That file holds credentials: it is
# listed in .gitignore and is never committed.
#
# On update, environment variables are merged, not replaced: a key removed from
# .ce-env stays set on the application until it is unset explicitly with
# `ibmcloud ce app update --name <app> --unset-env KEY`.

set -euo pipefail

# ---------------------------------------------------------------- #
# Deployment target                                                 #
# ---------------------------------------------------------------- #

REGISTRY="${REGISTRY:-ca.icr.io}"
REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-meridian-gov}"
REGISTRY_SECRET="${REGISTRY_SECRET:-icr-meridian}"
EXPECTED_ACCOUNT="${EXPECTED_ACCOUNT:-3117813}"

# The cloud session used for this account lives in its own config home, so this
# script cannot be affected by — and cannot disturb — a session another piece of
# work has active in the default one.
export IBMCLOUD_HOME="${IBMCLOUD_HOME:-$HOME/.ibmcloud-alignsf588}"

MIN_SCALE="${MIN_SCALE:-1}"
MAX_SCALE="${MAX_SCALE:-1}"

# ---------------------------------------------------------------- #
# Arguments                                                         #
# ---------------------------------------------------------------- #

die() { printf '\nABORT: %s\n' "$*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }

if [ "$#" -lt 3 ]; then
  cat >&2 <<'USAGE'
usage: deploy-service.sh <app-name> <service-dir> <port> [tag]

  app-name     application name, e.g. meridian-ap-api
  service-dir  directory holding the Dockerfile
  port         port the container listens on
  tag          optional image tag (default: git short SHA)
USAGE
  exit 64
fi

APP_NAME="$1"
SERVICE_DIR="$2"
PORT="$3"
TAG_ARG="${4:-}"

[ -d "$SERVICE_DIR" ] || die "service directory not found: $SERVICE_DIR"
[ -f "$SERVICE_DIR/Dockerfile" ] || die "no Dockerfile in $SERVICE_DIR"
case "$PORT" in (''|*[!0-9]*) die "port must be numeric, got '$PORT'";; esac

for bin in docker ibmcloud; do
  command -v "$bin" >/dev/null 2>&1 || die "$bin is not on PATH"
done

# ---------------------------------------------------------------- #
# 1. Confirm the account before anything is pushed anywhere         #
# ---------------------------------------------------------------- #

say "Verifying cloud session"
TARGET="$(ibmcloud target 2>&1)" || die "could not read the cloud session — run 'ibmcloud login' with IBMCLOUD_HOME=$IBMCLOUD_HOME"

if ! printf '%s' "$TARGET" | grep -q "$EXPECTED_ACCOUNT"; then
  printf '%s\n' "$TARGET" >&2
  die "session is NOT pointed at account $EXPECTED_ACCOUNT (see the target above).
       Nothing was built or pushed. Log in to the correct account with
       IBMCLOUD_HOME=$IBMCLOUD_HOME before re-running."
fi

printf '%s\n' "$TARGET" | sed -n 's/^\(Region\|Account\|Resource group\):/  &/p'
echo "  account $EXPECTED_ACCOUNT confirmed"

# ---------------------------------------------------------------- #
# 2. Resolve the image tag                                          #
# ---------------------------------------------------------------- #

if [ -n "$TAG_ARG" ]; then
  TAG="$TAG_ARG"
elif TAG="$(git -C "$SERVICE_DIR" rev-parse --short HEAD 2>/dev/null)" && [ -n "$TAG" ]; then
  : # git short SHA
else
  COUNTER_FILE="$SERVICE_DIR/.ce-build"
  N="$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)"
  case "$N" in (''|*[!0-9]*) N=0;; esac
  N=$((N + 1))
  printf '%s\n' "$N" > "$COUNTER_FILE"
  TAG="build$N"
fi

IMAGE="$REGISTRY/$REGISTRY_NAMESPACE/$APP_NAME:$TAG"

# ---------------------------------------------------------------- #
# 3. Build                                                          #
# ---------------------------------------------------------------- #

say "Building $IMAGE"
echo "  context: $SERVICE_DIR"
# --platform is mandatory: the platform runs linux/amd64, and an image built on
# an arm64 workstation without it starts and then dies with an exec format
# error that surfaces as an unexplained deployment failure minutes later.
docker build --platform linux/amd64 -t "$IMAGE" "$SERVICE_DIR"

# ---------------------------------------------------------------- #
# 4. Push                                                           #
# ---------------------------------------------------------------- #

say "Pushing to $REGISTRY"
ibmcloud cr login
docker push "$IMAGE"

# ---------------------------------------------------------------- #
# 5. Environment passthrough                                        #
# ---------------------------------------------------------------- #

ENV_ARGS=()
ENV_FILE="$SERVICE_DIR/.ce-env"
if [ -f "$ENV_FILE" ]; then
  say "Environment from $ENV_FILE"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue;;
    esac
    key="${line%%=*}"
    [ "$key" = "$line" ] && continue          # no '=' on the line
    # PORT is reserved by the platform: it is injected from --port, and an
    # application that also declares it is rejected outright by the admission
    # webhook. Skipping it here turns a confusing deployment failure into a
    # one-line notice.
    if [ "$key" = "PORT" ]; then
      echo "  $key (skipped — reserved by the platform, set from --port $PORT)"
      continue
    fi
    ENV_ARGS+=(--env "$line")
    echo "  $key"                              # names only; values are secret
  done < "$ENV_FILE"
else
  say "No .ce-env in $SERVICE_DIR — deploying with no environment passthrough"
fi

# ---------------------------------------------------------------- #
# 6. Create or update                                               #
# ---------------------------------------------------------------- #

if ibmcloud ce app get --name "$APP_NAME" >/dev/null 2>&1; then
  say "Updating application $APP_NAME"
  VERB=update
else
  say "Creating application $APP_NAME"
  VERB=create
fi

ibmcloud ce app "$VERB" \
  --name "$APP_NAME" \
  --image "$IMAGE" \
  --registry-secret "$REGISTRY_SECRET" \
  --port "$PORT" \
  --min-scale "$MIN_SCALE" \
  --max-scale "$MAX_SCALE" \
  "${ENV_ARGS[@]+"${ENV_ARGS[@]}"}" \
  --wait

# ---------------------------------------------------------------- #
# 7. Report                                                         #
# ---------------------------------------------------------------- #

URL="$(ibmcloud ce app get --name "$APP_NAME" --output url 2>/dev/null || true)"
[ -n "$URL" ] || die "application $APP_NAME deployed but no URL was returned"

say "Deployed"
echo "  application : $APP_NAME"
echo "  image       : $IMAGE"
echo "  url         : $URL"
echo
echo "Verify before continuing:"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' $URL/healthz     # expect: 200"
echo "  toolkit url : $URL/mcp"
