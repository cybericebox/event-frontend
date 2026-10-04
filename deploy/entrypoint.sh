#!/bin/sh
# Runtime env substitution for the standalone build. The build baked each
# NEXT_PUBLIC_* value as a placeholder equal to its variable name wrapped in double
# underscores (__NEXT_PUBLIC_X__; the bare name is also an object key in the server code); here we
# replace those placeholders with the actual runtime env values so the same
# image works across environments without a rebuild.
set -e

# One container, two processes: nginx (the only listener) in front of Next.js on 127.0.0.1:3001.
# nginx config lives in /etc/cybericebox/nginx (nginx.conf, server.conf and the snippets); this script only
# picks which snippets are active from the env and fills the values (envsubst, fixed variable list). Env:
#   HTTP_PORT           plain HTTP listener (default 3000; empty = off)
#   HTTPS_PORT          TLS listener (default 8443), on only when TLS_CERT_FILE and TLS_KEY_FILE are set
#   TLS_CERT_FILE, TLS_KEY_FILE      PEM server certificate chain and key; set both or neither
#   TLS_MIN_VERSION     1.2 (default) or 1.3
#   TLS_CLIENT_CA_FILE  PEM bundle that signed the client certificates
#   TLS_CLIENT_AUTH     off (default) | optional | require; optional and require need TLS_CLIENT_CA_FILE
#   HEALTH_PORT         if set: extra plain listener on HEALTH_BIND (default 0.0.0.0) that serves only /api/health
#   TLS_RELOAD_INTERVAL seconds between certificate file checks (default 60; 0 = off)
# tini is PID 1 (reaps zombies, forwards signals); this script supervises: when either process exits, the other
# one is stopped and the container exits, so Kubernetes restarts it.
HTTP_PORT=${HTTP_PORT-3000}
HTTPS_PORT=${HTTPS_PORT:-8443}
HEALTH_PORT=${HEALTH_PORT:-}
HEALTH_BIND=${HEALTH_BIND:-0.0.0.0}
TLS_CERT_FILE=${TLS_CERT_FILE:-}
TLS_KEY_FILE=${TLS_KEY_FILE:-}
TLS_MIN_VERSION=${TLS_MIN_VERSION:-1.2}
TLS_CLIENT_CA_FILE=${TLS_CLIENT_CA_FILE:-}
TLS_CLIENT_AUTH=${TLS_CLIENT_AUTH:-off}
TLS_RELOAD_INTERVAL=${TLS_RELOAD_INTERVAL:-60}

fail() {
  echo "$1" >&2
  exit 1
}
is_port() {
  case "$1" in '' | *[!0-9]*) return 1 ;; esac
  [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

tls=false
if [ -n "$TLS_CERT_FILE" ] || [ -n "$TLS_KEY_FILE" ]; then
  { [ -n "$TLS_CERT_FILE" ] && [ -n "$TLS_KEY_FILE" ]; } || fail "TLS_CERT_FILE and TLS_KEY_FILE must be set together."
  tls=true
fi
case "$TLS_MIN_VERSION" in
  1.2) TLS_PROTOCOLS="TLSv1.2 TLSv1.3" ;;
  1.3) TLS_PROTOCOLS="TLSv1.3" ;;
  *) fail "TLS_MIN_VERSION must be 1.2 or 1.3." ;;
esac
case "$TLS_CLIENT_AUTH" in
  off) TLS_CLIENT_VERIFY= ;;
  optional) TLS_CLIENT_VERIFY=optional ;;
  require) TLS_CLIENT_VERIFY=on ;;
  *) fail "TLS_CLIENT_AUTH must be off, optional or require." ;;
esac
if [ "$TLS_CLIENT_AUTH" != off ]; then
  [ "$tls" = true ] || fail "TLS_CLIENT_AUTH=$TLS_CLIENT_AUTH needs TLS_CERT_FILE and TLS_KEY_FILE."
  [ -n "$TLS_CLIENT_CA_FILE" ] || fail "TLS_CLIENT_AUTH=$TLS_CLIENT_AUTH needs TLS_CLIENT_CA_FILE."
fi
for f in "$TLS_CERT_FILE" "$TLS_KEY_FILE"; do
  [ "$tls" = false ] || [ -r "$f" ] || fail "$f is not readable."
done
[ "$TLS_CLIENT_AUTH" = off ] || [ -r "$TLS_CLIENT_CA_FILE" ] || fail "$TLS_CLIENT_CA_FILE is not readable."
[ -z "$HTTP_PORT" ] || is_port "$HTTP_PORT" || fail "HTTP_PORT must be a port number or empty."
[ "$tls" = false ] || is_port "$HTTPS_PORT" || fail "HTTPS_PORT must be a port number."
[ -z "$HEALTH_PORT" ] || is_port "$HEALTH_PORT" || fail "HEALTH_PORT must be a port number or empty."
case "$TLS_RELOAD_INTERVAL" in '' | *[!0-9]*) fail "TLS_RELOAD_INTERVAL must be a number of seconds." ;; esac
[ -n "$HTTP_PORT" ] || [ "$tls" = true ] || fail "Nothing to listen on: set HTTP_PORT or TLS_CERT_FILE and TLS_KEY_FILE."
export HTTP_PORT HTTPS_PORT HEALTH_PORT HEALTH_BIND TLS_CERT_FILE TLS_KEY_FILE TLS_PROTOCOLS TLS_CLIENT_CA_FILE TLS_CLIENT_VERIFY

# NEXT_PUBLIC_DOMAIN is the only host input (deploy/base-domain.sh, the same file in every frontend): every host derives from it in the
# code. The other operator values are required (no fallbacks); analytics is optional.
. /usr/local/lib/base-domain.sh
base_domain_check || exit 1
for name in NEXT_PUBLIC_SUPPORT_EMAIL NEXT_PUBLIC_PARTNER_ICE_NURE_URL NEXT_PUBLIC_PARTNER_NURE_URL NEXT_PUBLIC_WIREGUARD_INSTALL_URL; do
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

# nginx: the config files of /etc/cybericebox/nginx rendered into /tmp/nginx (the root filesystem is read-only).
# A snippet that is not active becomes an empty file. Static files are served from the same on-disk
# .next/static and public/ that the placeholder pass above just rewrote.
src=/etc/cybericebox/nginx
run=/tmp/nginx
conf=$run/nginx.conf
mkdir -p "$run"
vars='${HTTP_PORT} ${HTTPS_PORT} ${HEALTH_PORT} ${HEALTH_BIND} ${TLS_CERT_FILE} ${TLS_KEY_FILE} ${TLS_PROTOCOLS} ${TLS_CLIENT_CA_FILE} ${TLS_CLIENT_VERIFY}'
render() {
  envsubst "$vars" < "$src/$1" > "$run/$1"
}
skip() {
  : > "$run/$1"
}
render nginx.conf
render server.conf
if [ -n "$HTTP_PORT" ]; then render listen-http.conf; else skip listen-http.conf; fi
if [ "$tls" = true ]; then render listen-https.conf; else skip listen-https.conf; fi
if [ "$TLS_CLIENT_AUTH" != off ]; then render client-auth.conf; else skip client-auth.conf; fi
if [ -n "$HEALTH_PORT" ]; then render health.conf; else skip health.conf; fi
# A bad combination fails here, not at the first request.
nginx -e /dev/stderr -p "$run/" -c "$conf" -t

# Next.js stays internal. HOSTNAME is forced because Kubernetes sets it to the pod name.
export PORT=3001
export HOSTNAME=127.0.0.1

node server.js &
node_pid=$!
nginx -e /dev/stderr -p "$run/" -c "$conf" &
nginx_pid=$!

stop() {
  kill -TERM "$node_pid" "$nginx_pid" 2>/dev/null || true
  wait "$node_pid" "$nginx_pid" 2>/dev/null || true
}
trap 'stop; exit 0' TERM INT

# Cert reload without a restart: poll a checksum of the TLS files (Kubernetes swaps Secret mounts by symlink,
# which inotify does not see). On a change nginx -t decides: a config that does not load keeps the old one running.
# The loop is a child of this script: it ends when this script (the container's main process) ends.
reload_pid=
if [ "$tls" = true ] && [ "$TLS_RELOAD_INTERVAL" -gt 0 ]; then
  (
    sum() { cat "$TLS_CERT_FILE" "$TLS_KEY_FILE" ${TLS_CLIENT_CA_FILE:+"$TLS_CLIENT_CA_FILE"} 2>/dev/null | cksum; }
    last=$(sum)
    while sleep "$TLS_RELOAD_INTERVAL"; do
      kill -0 "$$" 2>/dev/null || exit 0
      now=$(sum)
      [ "$now" != "$last" ] || continue
      last=$now
      if nginx -e /dev/stderr -p "$run/" -c "$conf" -t; then
        nginx -e /dev/stderr -p "$run/" -c "$conf" -s reload && echo "TLS files changed: nginx reloaded." >&2
      else
        echo "TLS files changed but nginx -t failed: keeping the running config." >&2
      fi
    done
  ) &
  reload_pid=$!
fi

# Supervise: the first process to exit takes the container down.
while kill -0 "$node_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1 &
  wait $! || true
done
echo "A process exited (next: $(kill -0 "$node_pid" 2>/dev/null && echo up || echo down), nginx: $(kill -0 "$nginx_pid" 2>/dev/null && echo up || echo down)); stopping." >&2
[ -z "$reload_pid" ] || kill "$reload_pid" 2>/dev/null || true
stop
exit 1
