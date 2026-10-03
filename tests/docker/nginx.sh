#!/bin/sh
# Container tests of the nginx layer: plain, TLS, client auth (require / optional), start errors, the
# health-only listener and a live certificate replacement. Needs docker.
#   IMAGE=<image> tests/docker/nginx.sh        (default: build deploy/Dockerfile as event-frontend:nginx-test)
set -u
cd "$(dirname "$0")/../.."
IMAGE=${IMAGE:-}
if [ -z "$IMAGE" ]; then
  IMAGE=event-frontend:nginx-test
  docker build -q -f deploy/Dockerfile -t "$IMAGE" . >/dev/null || exit 1
fi

work=$(mktemp -d)
certs=$work/certs
mkdir -p "$certs"
tools=event-frontend-nginx-tools
docker build -q -t "$tools" - >/dev/null <<'DOCKER' || exit 1
FROM alpine:3.24.2
RUN apk add --no-cache curl openssl
DOCKER

pass=0
failed=0
names=
cleanup() {
  for n in $names; do docker rm -f "$n" >/dev/null 2>&1; done
  rm -rf "$work"
}
trap cleanup EXIT INT TERM

ok() { pass=$((pass + 1)); echo "ok    $1"; }
bad() { failed=$((failed + 1)); echo "FAIL  $1 ${2:-}"; }
check() { # name, expected, actual
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "(want '$2', got '$3')"; fi
}

# Certificates: two CAs, a server certificate (and a second one for the reload test), client certificates.
docker run --rm -v "$certs:/c" -w /c "$tools" sh -ec '
  mkca() { openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=$1" -keyout $1.key -out $1.crt; }
  mkleaf() { # name ca cn ext
    openssl req -newkey rsa:2048 -nodes -subj "/CN=$3" -keyout $1.key -out $1.csr
    printf "%s\n" "$4" > $1.ext
    openssl x509 -req -in $1.csr -CA $2.crt -CAkey $2.key -CAcreateserial -days 2 -extfile $1.ext -out $1.crt
  }
  mkca ca1; mkca ca2
  mkleaf server1 ca1 server-one "subjectAltName=DNS:localhost"
  mkleaf server2 ca1 server-two "subjectAltName=DNS:localhost"
  mkleaf client1 ca1 client-ok "extendedKeyUsage=clientAuth"
  mkleaf client2 ca2 client-bad "extendedKeyUsage=clientAuth"
  mkdir live; cp server1.crt live/tls.crt; cp server1.key live/tls.key; cp ca1.crt live/ca.crt
  chmod -R a+rX /c; chmod a+r /c/*.key /c/live/*
' >/dev/null 2>&1 || { echo "certificate generation failed"; exit 1; }

envs="-e NEXT_PUBLIC_MAIN_HOST=m.test -e NEXT_PUBLIC_API_HOST=a.test -e NEXT_PUBLIC_ID_HOST=i.test
 -e NEXT_PUBLIC_ADMIN_HOST=ad.test -e NEXT_PUBLIC_EXERCISES_HOST=e.test -e NEXT_PUBLIC_EVENT_DOMAIN=ev.test
 -e NEXT_PUBLIC_COOKIE_DOMAIN=test -e NEXT_PUBLIC_SUPPORT_EMAIL=s@test -e NEXT_PUBLIC_PARTNER_URL=https://p.test
 -e NEXT_PUBLIC_PARTNER_SITE_URL=https://p.test -e NEXT_PUBLIC_WIREGUARD_INSTALL_URL=https://w.test"

# start <name> [docker run args...]: a container with dropped capabilities and the cert directory.
start() {
  n=$1; shift
  names="$names $n"
  # shellcheck disable=SC2086
  docker run -d --name "$n" --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp \
    -v "$certs/live:/tls:ro" -v "$certs:/pki:ro" $envs "$@" "$IMAGE" >/dev/null
}
# c <name> <curl args...>: curl from inside the container's network namespace.
c() {
  n=$1; shift
  docker run --rm --network "container:$n" -v "$certs:/pki:ro" "$tools" curl -s -m 5 "$@"
}
code() { n=$1; shift; c "$n" -o /dev/null -w '%{http_code}' "$@"; }
# wait_up <name> <url> [curl args]: until the URL answers 200 (up to 60 s).
wait_up() {
  n=$1; u=$2; shift 2
  i=0
  while [ $i -lt 60 ]; do
    [ "$(code "$n" "$@" "$u" 2>/dev/null)" = 200 ] && return 0
    docker ps -q -f "name=^$n\$" | grep -q . || return 1
    i=$((i + 1)); sleep 1
  done
  return 1
}
# fails_to_start <test> <expected log text> <docker args...>
fails_to_start() {
  t=$1; want=$2; shift 2
  n=ef-fail-$$-$pass-$failed
  names="$names $n"
  # shellcheck disable=SC2086
  out=$(docker run --name "$n" --cap-drop ALL --tmpfs /tmp -v "$certs/live:/tls:ro" $envs "$@" "$IMAGE" 2>&1)
  rc=$?
  if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q "$want"; then ok "$t"; else bad "$t" "(rc=$rc: $(printf '%s' "$out" | tail -2))"; fi
}
subject() { # name, curl args: CN of the served server certificate
  n=$1; shift
  docker run --rm --network "container:$n" "$tools" sh -c "echo | openssl s_client -connect localhost:8443 -servername localhost $* 2>/dev/null | openssl x509 -noout -subject" 2>/dev/null
}

echo "== plain only (default)"
start ef-plain
wait_up ef-plain http://localhost:3000/api/health && ok "plain: health on 3000" || bad "plain: health on 3000"
check "plain: 8443 closed" 000 "$(code ef-plain -k https://localhost:8443/api/health)"
check "plain: root page served" 200 "$(code ef-plain http://localhost:3000/)"
check "plain: static asset cache header" "public, max-age=31536000, immutable" \
  "$(docker exec ef-plain sh -c 'f=$(ls /app/.next/static/chunks/*.js | head -1); echo ${f#/app/.next/static/}' | xargs -I{} docker run --rm --network container:ef-plain "$tools" sh -c "curl -sI http://localhost:3000/_next/static/{} | tr -d '\r' | sed -n 's/^[Cc]ache-[Cc]ontrol: //p'")"
docker rm -f ef-plain >/dev/null

echo "== plain on a custom port, HTTP off"
start ef-port -e HTTP_PORT=8080
wait_up ef-port http://localhost:8080/api/health && ok "custom HTTP_PORT" || bad "custom HTTP_PORT"
check "custom HTTP_PORT: 3000 closed" 000 "$(code ef-port http://localhost:3000/)"
docker rm -f ef-port >/dev/null

echo "== TLS only"
start ef-tls -e HTTP_PORT= -e TLS_CERT_FILE=/tls/tls.crt -e TLS_KEY_FILE=/tls/tls.key
wait_up ef-tls https://localhost:8443/api/health --cacert /pki/ca1.crt && ok "tls: health over https with the CA" || bad "tls: health over https"
check "tls: plain port off" 000 "$(code ef-tls http://localhost:3000/)"
check "tls: unknown CA refused" 000 "$(code ef-tls https://localhost:8443/api/health)"
check "tls: http2" 2 "$(c ef-tls --cacert /pki/ca1.crt -o /dev/null -w '%{http_version}' https://localhost:8443/api/health)"
check "tls: TLS 1.2 accepted" 200 "$(code ef-tls --cacert /pki/ca1.crt --tlsv1.2 --tls-max 1.2 https://localhost:8443/api/health)"
docker rm -f ef-tls >/dev/null

echo "== TLS_MIN_VERSION=1.3"
start ef-13 -e HTTP_PORT= -e TLS_CERT_FILE=/tls/tls.crt -e TLS_KEY_FILE=/tls/tls.key -e TLS_MIN_VERSION=1.3
wait_up ef-13 https://localhost:8443/api/health --cacert /pki/ca1.crt && ok "min 1.3: TLS 1.3 works" || bad "min 1.3: TLS 1.3 works"
check "min 1.3: TLS 1.2 refused" 000 "$(code ef-13 --cacert /pki/ca1.crt --tlsv1.2 --tls-max 1.2 https://localhost:8443/api/health)"
docker rm -f ef-13 >/dev/null

echo "== TLS + HTTP together, health port, client auth require"
start ef-req -e TLS_CERT_FILE=/tls/tls.crt -e TLS_KEY_FILE=/tls/tls.key -e TLS_CLIENT_CA_FILE=/tls/ca.crt \
  -e TLS_CLIENT_AUTH=require -e HEALTH_PORT=8081
wait_up ef-req http://localhost:8081/api/health && ok "health port serves /api/health" || bad "health port serves /api/health"
check "health port: other paths 404" 404 "$(code ef-req http://localhost:8081/)"
check "require: no client cert refused" 000 "$(code ef-req --cacert /pki/ca1.crt https://localhost:8443/api/health)"
check "require: cert of another CA refused" 000 "$(code ef-req --cacert /pki/ca1.crt --cert /pki/client2.crt --key /pki/client2.key https://localhost:8443/api/health)"
check "require: valid cert accepted" 200 "$(code ef-req --cacert /pki/ca1.crt --cert /pki/client1.crt --key /pki/client1.key https://localhost:8443/api/health)"
check "require: plain port still open" 200 "$(code ef-req http://localhost:3000/api/health)"
docker rm -f ef-req >/dev/null

echo "== client auth optional"
start ef-opt -e HTTP_PORT= -e TLS_CERT_FILE=/tls/tls.crt -e TLS_KEY_FILE=/tls/tls.key -e TLS_CLIENT_CA_FILE=/tls/ca.crt \
  -e TLS_CLIENT_AUTH=optional
wait_up ef-opt https://localhost:8443/api/health --cacert /pki/ca1.crt && ok "optional: no cert accepted" || bad "optional: no cert accepted"
check "optional: valid cert accepted" 200 "$(code ef-opt --cacert /pki/ca1.crt --cert /pki/client1.crt --key /pki/client1.key https://localhost:8443/api/health)"
echo "info  optional: cert of another CA presented -> http code $(code ef-opt --cacert /pki/ca1.crt --cert /pki/client2.crt --key /pki/client2.key https://localhost:8443/api/health) (000 = refused)"
check "optional: invalid cert refused" 000 "$(code ef-opt --cacert /pki/ca1.crt --cert /pki/client2.crt --key /pki/client2.key https://localhost:8443/api/health)"
docker rm -f ef-opt >/dev/null

echo "== start errors"
fails_to_start "cert without key" "must be set together" -e TLS_CERT_FILE=/tls/tls.crt
fails_to_start "key without cert" "must be set together" -e TLS_KEY_FILE=/tls/tls.key
fails_to_start "client auth without CA file" "needs TLS_CLIENT_CA_FILE" -e TLS_CERT_FILE=/tls/tls.crt -e TLS_KEY_FILE=/tls/tls.key -e TLS_CLIENT_AUTH=require
fails_to_start "client auth without TLS" "needs TLS_CERT_FILE" -e TLS_CLIENT_CA_FILE=/tls/ca.crt -e TLS_CLIENT_AUTH=optional
fails_to_start "no listener" "Nothing to listen on" -e HTTP_PORT=
fails_to_start "bad TLS_MIN_VERSION" "TLS_MIN_VERSION must be" -e TLS_MIN_VERSION=1.1
fails_to_start "bad TLS_CLIENT_AUTH" "TLS_CLIENT_AUTH must be" -e TLS_CLIENT_AUTH=yes
fails_to_start "unreadable cert file" "is not readable" -e TLS_CERT_FILE=/tls/nope.crt -e TLS_KEY_FILE=/tls/tls.key

echo "== live certificate replacement"
mkdir -p "$work/rl"; cp "$certs/live/"* "$work/rl/"; chmod a+rx "$work/rl"; chmod a+r "$work/rl/"*
names="$names ef-reload"
docker run -d --name ef-reload --cap-drop ALL --tmpfs /tmp -v "$work/rl:/tls" $envs \
  -e HTTP_PORT= -e TLS_CERT_FILE=/tls/tls.crt -e TLS_KEY_FILE=/tls/tls.key -e TLS_RELOAD_INTERVAL=2 "$IMAGE" >/dev/null
wait_up ef-reload https://localhost:8443/api/health --cacert /pki/ca1.crt && ok "reload: up" || bad "reload: up"
start_id=$(docker inspect -f '{{.State.StartedAt}}' ef-reload)
check "reload: first certificate served" "subject=CN=server-one" "$(subject ef-reload | tr -d ' ')"
cp "$certs/server2.crt" "$work/rl/tls.crt"; cp "$certs/server2.key" "$work/rl/tls.key"
i=0; got=
while [ $i -lt 15 ]; do
  got=$(subject ef-reload | tr -d ' ')
  [ "$got" = "subject=CN=server-two" ] && break
  i=$((i + 1)); sleep 1
done
check "reload: replaced certificate served without restart" "subject=CN=server-two" "$got"
check "reload: container not restarted" "$start_id" "$(docker inspect -f '{{.State.StartedAt}}' ef-reload)"
# A broken replacement keeps the old config running.
printf 'garbage' > "$work/rl/tls.crt"
sleep 5
check "reload: broken cert keeps serving the old one" "subject=CN=server-two" "$(subject ef-reload | tr -d ' ')"
docker logs ef-reload 2>&1 | grep -q "nginx -t failed" && ok "reload: failure logged" || bad "reload: failure logged"
# The loop must not outlive the container's main work: stopping the container leaves nothing.
docker stop -t 5 ef-reload >/dev/null
check "reload: container exits on stop" "false" "$(docker inspect -f '{{.State.Running}}' ef-reload)"
docker rm -f ef-reload >/dev/null

echo
echo "passed $pass, failed $failed"
[ "$failed" -eq 0 ]
