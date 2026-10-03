#!/bin/sh
# Runtime env substitution for the standalone build. The build baked each
# NEXT_PUBLIC_* value as a placeholder equal to its variable name wrapped in double
# underscores (__NEXT_PUBLIC_X__; the bare name is also an object key in the server code); here we
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

# One pass: a single sed script with an expression per NEXT_PUBLIC_* variable, run once over each
# file that holds a placeholder (in parallel: busybox sed is slow on the minified bundles). Only the
# wrapped token is replaced; the bare name is also an object key and plain text in the bundle.
# Files without a placeholder are never rewritten.
script=$(mktemp)
trap 'rm -f "$script"' EXIT
printenv | grep '^NEXT_PUBLIC_' | while IFS='=' read -r key value; do
  # Escape sed-special chars in the replacement (| delimiter, & match-ref, \).
  esc=$(printf '%s' "$value" | sed -e 's/[\\&|]/\\&/g')
  printf 's|__%s__|%s|g\n' "$key" "$esc"
done > "$script"

grep -rlIE '__NEXT_PUBLIC_[A-Z0-9_]+__' /app/.next | xargs -r -n 1 -P "$(nproc)" sed -i -f "$script"

# A placeholder that is still there means its variable is missing: fail the start, not the page.
left=
# The cheap fixed-string scan first; the token names are only collected when something is left.
if grep -rqIF '__NEXT_PUBLIC_' /app/.next; then
  left=$(grep -rhoIE '__NEXT_PUBLIC_[A-Z0-9_]+__' /app/.next | sort -u | tr '\n' ' ')
fi
if [ -n "$left" ]; then
  echo "No value for: $left(set the variable, an empty one is fine for an optional value)." >&2
  exit 1
fi

rm -f "$script"
exec node server.js
