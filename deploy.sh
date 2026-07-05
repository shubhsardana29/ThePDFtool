#!/usr/bin/env bash
# Deploy (or redeploy) the production stack on this host.
# Usage: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

# DEPLOY_MODE=proxy in .env → no Caddy; an existing host proxy terminates TLS
# and forwards to 127.0.0.1:${WEB_PORT:-3020}.
COMPOSE_FILE=docker-compose.prod.yml
MODE=edge
if grep -qE '^DEPLOY_MODE=proxy' .env 2>/dev/null; then
  COMPOSE_FILE=docker-compose.proxy.yml
  MODE=proxy
fi

# Prefer the compose v2 plugin; fall back to standalone docker-compose.
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose -p pdftools -f "$COMPOSE_FILE")
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose -p pdftools -f "$COMPOSE_FILE")
else
  echo "Docker Compose not found. Install it first:"
  echo "  sudo apt-get update && sudo apt-get install -y docker-compose-plugin"
  echo "  (or on Ubuntu's docker.io package: docker-compose-v2)"
  exit 1
fi

if [ ! -f .env ]; then
  echo "No .env file. Create one first:"
  echo "  echo \"AUTH_SECRET=\$(openssl rand -base64 32)\" > .env"
  echo "  echo \"SITE_DOMAIN=your-domain.com\" >> .env"
  echo "  echo \"NEXT_PUBLIC_SITE_URL=https://your-domain.com\" >> .env"
  exit 1
fi

echo "==> Building images"
"${COMPOSE[@]}" build

echo "==> Starting stack"
"${COMPOSE[@]}" up -d

# `up -d` won't restart caddy for Caddyfile-only changes (it's a bind mount) —
# reload its config explicitly. Falls back to restart on older caddy images.
if [ "$MODE" = "edge" ]; then
  "${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null \
    || "${COMPOSE[@]}" restart caddy
fi

echo "==> Waiting for web to become healthy"
for i in $(seq 1 45); do
  cid=$("${COMPOSE[@]}" ps -q web 2>/dev/null | head -1)
  status=$(docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)
  if [ "$status" = "healthy" ]; then
    echo "==> Healthy. Deployed."
    docker image prune -f >/dev/null
    "${COMPOSE[@]}" ps
    exit 0
  fi
  sleep 2
done

echo "!! web did not become healthy — recent logs:"
"${COMPOSE[@]}" logs --tail 40 web
exit 1
