import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

// The nginx config is rendered by deploy/entrypoint.sh (envsubst); these tests read the templates and the entrypoint as text.
const root = resolve(import.meta.dirname, "..")
const read = (file: string) => readFileSync(resolve(root, file), "utf8")
// Comments dropped, so a value mentioned only in a comment does not count.
const code = (file: string) =>
  read(file)
    .split("\n")
    .map((line) => line.replace(/#.*$/, ""))
    .join("\n")

const main = code("deploy/nginx/nginx.conf")
const server = code("deploy/nginx/server.conf")
const health = code("deploy/nginx/health.conf")
const entrypoint = read("deploy/entrypoint.sh")

const limitFunction = entrypoint.match(/^limit_conn_directive\(\) \{\n[\s\S]*?\n\}$/m)?.[0] ?? ""
function limitDirective(value: string) {
  const run = spawnSync("sh", ["-c", `${limitFunction}\nlimit_conn_directive "$1"`, "sh", value], { encoding: "utf8" })
  return { status: run.status, out: run.stdout.trim() }
}

describe("nginx limits and timeouts", () => {
  it("keys the connection zone on CF-Connecting-IP only after a verified client certificate", () => {
    expect(main).toMatch(/map\s+\$ssl_client_verify\s+\$\w+\s*{[^}]*default\s+\$binary_remote_addr;[^}]*SUCCESS\s+\$\w+;/)
    expect(main).toContain("$http_cf_connecting_ip")
    expect(main).toMatch(/limit_conn_zone\s+\$\w+\s+zone=\w+:\d+m;/)
    expect(main).toMatch(/limit_conn_status\s+429;/)
  })

  it("falls back to the socket address when the header is empty", () => {
    expect(main).toMatch(/map\s+\$http_cf_connecting_ip\s+\$\w+\s*{[^}]*''\s+\$binary_remote_addr;/)
  })

  it("applies the per-IP cap through a rendered line that the entrypoint can drop", () => {
    expect(server).toContain("${NGINX_LIMIT_CONN}")
    expect(entrypoint).toMatch(/NGINX_LIMIT_CONN_PER_IP=\$\{NGINX_LIMIT_CONN_PER_IP-400\}/)
    expect(entrypoint).toMatch(/NGINX_LIMIT_CONN=\$\(limit_conn_directive "\$NGINX_LIMIT_CONN_PER_IP"\) \|\| fail /)
  })

  // Runs the entrypoint's own function in sh: nginx refuses "00" and values above 65535, so they must never reach the config.
  it.each([
    ["400", "limit_conn client_conn 400;"],
    ["0400", "limit_conn client_conn 400;"],
    ["65535", "limit_conn client_conn 65535;"],
    ["0", ""],
    ["00", ""],
  ])("renders NGINX_LIMIT_CONN_PER_IP=%s as %j", (value, line) => {
    expect(limitDirective(value)).toEqual({status: 0, out: line})
  })

  it.each(["65536", "100000", "0000070000", "", "-1", "4 00", "abc"])("refuses NGINX_LIMIT_CONN_PER_IP=%j", (value) => {
    expect(limitDirective(value).status).toBe(1)
  })

  it("lists the new variable in the envsubst list and leaves nginx variables alone", () => {
    const vars = entrypoint.match(/^vars='([^']*)'/m)?.[1] ?? ""
    expect(vars).toContain("${NGINX_LIMIT_CONN}")
    expect(vars).not.toContain("binary_remote_addr")
  })

  it("sets the short client and keepalive timeouts", () => {
    expect(main).toMatch(/client_header_timeout\s+10s;/)
    expect(main).toMatch(/client_body_timeout\s+10s;/)
    expect(main).toMatch(/send_timeout\s+15s;/)
    expect(main).toMatch(/keepalive_timeout\s+30s;/)
    expect(main).not.toMatch(/keepalive_timeout\s+75s/)
  })

  it("sets the upstream timeouts of @next", () => {
    expect(server).toMatch(/proxy_connect_timeout\s+5s;/)
    expect(server).toMatch(/proxy_read_timeout\s+30s;/)
    expect(server).toMatch(/proxy_send_timeout\s+30s;/)
  })

  it("has no 1h timeout outside comments", () => {
    for (const text of [main, server, health]) {
      expect(text).not.toMatch(/timeout\s+1h/)
    }
  })

  it("does not limit the health listener", () => {
    expect(health).not.toContain("limit_conn")
  })
})
