#!/bin/sh
# Runtime env substitution for the standalone build. The build baked each
# NEXT_PUBLIC_* value as a placeholder equal to its variable name; here we
# replace those placeholders with the actual runtime env values so the same
# image works across environments without a rebuild.
set -e

# Every host is required from the deployment env (no fallbacks); analytics is optional.
for name in NEXT_PUBLIC_MAIN_HOST NEXT_PUBLIC_API_HOST NEXT_PUBLIC_ID_HOST NEXT_PUBLIC_ADMIN_HOST \
  NEXT_PUBLIC_EXERCISES_HOST NEXT_PUBLIC_EVENT_DOMAIN NEXT_PUBLIC_COOKIE_DOMAIN NEXT_PUBLIC_SUPPORT_EMAIL \
  NEXT_PUBLIC_PARTNER_URL NEXT_PUBLIC_PARTNER_SITE_URL NEXT_PUBLIC_WIREGUARD_INSTALL_URL; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "$name is required." >&2
    exit 1
  fi
done
: "${NEXT_PUBLIC_GOOGLE_ANALYTICS_ID:=}"
export NEXT_PUBLIC_GOOGLE_ANALYTICS_ID

# Bot check and DoS protection (see the README). Defaults: no provider, protection off.
: "${NEXT_PUBLIC_CAPTCHA_PROVIDER:=none}"
: "${NEXT_PUBLIC_CAPTCHA_SITE_KEY:=}"
: "${NEXT_PUBLIC_RECAPTCHA_ENTERPRISE:=false}"
: "${NEXT_PUBLIC_DOS_PROTECTION:=off}"
export NEXT_PUBLIC_CAPTCHA_PROVIDER NEXT_PUBLIC_CAPTCHA_SITE_KEY NEXT_PUBLIC_RECAPTCHA_ENTERPRISE NEXT_PUBLIC_DOS_PROTECTION
case "$NEXT_PUBLIC_CAPTCHA_PROVIDER" in
  turnstile | recaptcha) ;;
  none) ;;
  *) echo "NEXT_PUBLIC_CAPTCHA_PROVIDER must be turnstile, recaptcha or none." >&2; exit 1 ;;
esac
case "$NEXT_PUBLIC_DOS_PROTECTION" in
  on | off) ;;
  *) echo "NEXT_PUBLIC_DOS_PROTECTION must be on or off." >&2; exit 1 ;;
esac
if [ "$NEXT_PUBLIC_CAPTCHA_PROVIDER" != "none" ] && [ -z "$NEXT_PUBLIC_CAPTCHA_SITE_KEY" ]; then
  echo "NEXT_PUBLIC_CAPTCHA_SITE_KEY is required when NEXT_PUBLIC_CAPTCHA_PROVIDER is not none." >&2
  exit 1
fi

printenv | grep '^NEXT_PUBLIC_' | while IFS='=' read -r key value; do
  # Escape sed-special chars in the replacement (| delimiter, & match-ref, \).
  esc=$(printf '%s' "$value" | sed -e 's/[\\&|]/\\&/g')
  # Only .next is writable by the runtime user; server.js carries nothing but dev origins.
  grep -rlF "$key" /app/.next 2>/dev/null | while read -r file; do
    sed -i "s|${key}|${esc}|g" "$file"
  done || true
done

exec node server.js
