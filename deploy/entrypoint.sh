#!/bin/sh
# Runtime env substitution for the standalone build. The build baked each
# NEXT_PUBLIC_* value as a placeholder equal to its variable name wrapped in double
# underscores (__NEXT_PUBLIC_X__; the bare name is also an object key in the server code); here we
# replace those placeholders with the actual runtime env values so the same
# image works across environments without a rebuild.
set -e

# One container, two processes: nginx (the only listener) in front of Next.js on 127.0.0.1:3001.
#   ORIGIN_TLS=false (default)  nginx serves plain HTTP on 3000
#   ORIGIN_TLS=true             nginx serves TLS (http2) on 8443 with /tls/tls.crt + /tls/tls.key, and a plain
#                               health listener on $HEALTH_BIND:8081 that serves only /api/health
#   ORIGIN_MTLS=true            with ORIGIN_TLS: a client certificate signed by /aop/ca.crt is required
# tini is PID 1 (reaps zombies, forwards signals); this script supervises: when either process exits, the other
# one is stopped and the container exits, so Kubernetes restarts it.
ORIGIN_TLS=${ORIGIN_TLS:-false}
ORIGIN_MTLS=${ORIGIN_MTLS:-false}
HEALTH_BIND=${HEALTH_BIND:-0.0.0.0}
for flag in ORIGIN_TLS ORIGIN_MTLS; do
  eval "value=\$$flag"
  case "$value" in true | false) ;; *)
    echo "$flag must be true or false." >&2
    exit 1
    ;;
  esac
done
if [ "$ORIGIN_TLS" = true ]; then
  for f in /tls/tls.crt /tls/tls.key; do
    [ -r "$f" ] || { echo "$f is required when ORIGIN_TLS=true." >&2; exit 1; }
  done
  if [ "$ORIGIN_MTLS" = true ] && [ ! -r /aop/ca.crt ]; then
    echo "/aop/ca.crt is required when ORIGIN_MTLS=true." >&2
    exit 1
  fi
fi

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

# nginx: config generated into /tmp (the root filesystem is read-only), static files from the same on-disk
# .next/static and public/ that the placeholder pass above just rewrote.
run=/tmp/nginx
mkdir -p "$run"
conf=$run/nginx.conf
mtls_lines=
if [ "$ORIGIN_MTLS" = true ]; then
  # A missing or invalid client certificate: the connection is closed without any response (444).
  mtls_lines="ssl_client_certificate /aop/ca.crt;
    ssl_verify_client on;
    error_page 495 496 497 = @drop;"
fi
if [ "$ORIGIN_TLS" = true ]; then
  main_listen="listen 8443 ssl;
    http2 on;
    ssl_certificate /tls/tls.crt;
    ssl_certificate_key /tls/tls.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:5m;
    ssl_session_timeout 1h;
    ssl_session_tickets off;
    $mtls_lines"
  health_server="server {
    listen $HEALTH_BIND:8081;
    access_log off;
    location = /api/health {
      proxy_pass http://next;
      proxy_set_header Host \$http_host;
    }
    location / {
      return 404;
    }
  }"
else
  main_listen="listen 3000;"
  health_server=
fi
cat > "$conf" <<NGINX
daemon off;
pid $run/nginx.pid;
error_log /dev/stderr warn;
worker_processes 2;
events {
  worker_connections 4096;
}
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;
  client_body_temp_path $run/client_body;
  proxy_temp_path $run/proxy;
  fastcgi_temp_path $run/fastcgi;
  uwsgi_temp_path $run/uwsgi;
  scgi_temp_path $run/scgi;
  server_tokens off;
  sendfile on;
  client_max_body_size 64m;
  keepalive_timeout 75s;

  gzip on;
  gzip_comp_level 5;
  gzip_min_length 256;
  gzip_vary on;
  gzip_proxied any;
  gzip_types text/plain text/css text/xml text/javascript application/javascript application/json
    application/xml application/manifest+json image/svg+xml;

  map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
  }
  map \$http_x_forwarded_proto \$forwarded_proto {
    default \$http_x_forwarded_proto;
    '' \$scheme;
  }

  upstream next {
    server 127.0.0.1:3001;
    keepalive 32;
  }

  server {
    $main_listen
    server_name _;

    location /_next/static/ {
      alias /app/.next/static/;
      access_log off;
      add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    # Files of public/ (anything with an extension) from disk; everything else, and a missing file, goes to Next.
    location ~* \.[a-z0-9]+\$ {
      root /app/public;
      try_files \$uri @next;
    }

    location / {
      try_files /dev/null @next;
    }

    location @next {
      proxy_pass http://next;
      proxy_http_version 1.1;
      proxy_set_header Host \$http_host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$forwarded_proto;
      proxy_set_header X-Forwarded-Host \$http_host;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection \$connection_upgrade;
      proxy_set_header Accept-Encoding "";
      proxy_buffering off;
      proxy_request_buffering off;
      proxy_read_timeout 1h;
      proxy_send_timeout 1h;
    }

    location @drop {
      return 444;
    }
  }
  $health_server
}
NGINX

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

# Cert reload without a restart: the Secret volumes swap their files by symlink; check every 60s.
if [ "$ORIGIN_TLS" = true ]; then
  (
    sum() { cat /tls/* /aop/* 2>/dev/null | cksum; }
    last=$(sum)
    while sleep 60; do
      now=$(sum)
      if [ "$now" != "$last" ]; then
        last=$now
        nginx -e /dev/stderr -p "$run/" -c "$conf" -s reload || true
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
[ -z "${reload_pid:-}" ] || kill "$reload_pid" 2>/dev/null || true
stop
exit 1
