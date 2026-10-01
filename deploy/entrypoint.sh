#!/bin/sh
# Runtime env substitution for the standalone build. The build baked each
# NEXT_PUBLIC_* value as a placeholder equal to its variable name; here we
# replace those placeholders with the actual runtime env values so the same
# image works across environments without a rebuild.
set -e

# Every host is required from the deployment env (no fallbacks); analytics is optional.
for name in NEXT_PUBLIC_MAIN_HOST NEXT_PUBLIC_API_HOST NEXT_PUBLIC_ID_HOST NEXT_PUBLIC_ADMIN_HOST \
  NEXT_PUBLIC_EXERCISES_HOST NEXT_PUBLIC_EVENT_DOMAIN \
  NEXT_PUBLIC_PARTNER_URL NEXT_PUBLIC_PARTNER_SITE_URL NEXT_PUBLIC_WIREGUARD_INSTALL_URL; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "$name is required." >&2
    exit 1
  fi
done
: "${NEXT_PUBLIC_GOOGLE_ANALYTICS_ID:=}"
export NEXT_PUBLIC_GOOGLE_ANALYTICS_ID

printenv | grep '^NEXT_PUBLIC_' | while IFS='=' read -r key value; do
  # Escape sed-special chars in the replacement (| delimiter, & match-ref, \).
  esc=$(printf '%s' "$value" | sed -e 's/[\\&|]/\\&/g')
  # Only .next is writable by the runtime user; server.js carries nothing but dev origins.
  grep -rlF "$key" /app/.next 2>/dev/null | while read -r file; do
    sed -i "s|${key}|${esc}|g" "$file"
  done || true
done

exec node server.js
