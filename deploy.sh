#!/usr/bin/env bash
# Deploy (or redeploy) the production stack on this host.
# Usage: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE=(docker compose -p pdftools -f docker-compose.prod.yml)

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
"${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null \
  || "${COMPOSE[@]}" restart caddy

echo "==> Waiting for web to become healthy"
for i in $(seq 1 45); do
  status=$("${COMPOSE[@]}" ps --format '{{.Health}}' web 2>/dev/null || echo starting)
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
