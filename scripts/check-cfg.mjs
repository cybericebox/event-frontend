// CI check for the optional installation settings (README, Configuration → Installation settings).
//
// The event frontend is a Node server image: no page is prerendered with the settings, every route is rendered per request, and the container
// entrypoint replaces the placeholders in /app/.next (server and client chunks). So the check works on the standalone build:
//   1. it builds like deploy/Dockerfile does (every NEXT_PUBLIC_* set to its placeholder __NEXT_PUBLIC_X__) and checks that every setting token
//      is in the built output (a comparison folded by the minifier, or a lost token, fails here: this is how NEXT_PUBLIC_SHOW_PARTNERS was
//      found dead in the ID image); a prerendered page, if there ever is one, must carry the <html> attributes;
//   2. it applies the entrypoint's substitution (every placeholder replaced by the value, an unset one by "") to copies of the build with all
//      values set and with all empty, checks that no placeholder is left, starts the copy and reads the <html> attributes of a rendered page;
//   3. a build with an EMPTY value (NEXT_PUBLIC_X="") renders data-cfg-x="" (not a missing attribute).
// The substitution is the rule of deploy/entrypoint.sh (one expression per variable, `__NAME__` -> value) done in node, so it also runs on a
// developer's machine without Docker. `--no-build` reuses an existing placeholder build in .next/ (checks 1 and 2 only).
import {spawn, spawnSync} from "node:child_process";
import {cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from "node:fs";
import {request} from "node:http";
import {createServer} from "node:net";
import {tmpdir} from "node:os";
import {join} from "node:path";

const ROOT = join(import.meta.dirname, "..");
const NEXT = join(ROOT, ".next");
// A page every site renders through the root layout without needing the backend.
const PROBE = "/faq";
const HOST = "example.test";

function fail(message) {
    console.error(`check-cfg: ${message}`);
    process.exit(1);
}

const settingsSource = readFileSync(join(ROOT, "src/utils/settings.ts"), "utf8");
const settings = [...settingsSource.matchAll(/"(data-cfg-[a-z-]+)":\s*process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)].map((m) => ({attr: m[1], name: m[2]}));
if (settings.length === 0) fail("no settings found in src/utils/settings.ts");

// The variables of the Dockerfile's ENV, as the image build sets them.
const dockerfile = readFileSync(join(ROOT, "deploy/Dockerfile"), "utf8");
const placeholders = Object.fromEntries([...dockerfile.matchAll(/ENV (NEXT_PUBLIC_[A-Z0-9_]+)="(__NEXT_PUBLIC_[A-Z0-9_]+__)"/g)].map((m) => [m[1], m[2]]));
for (const {name} of settings) if (placeholders[name] !== `__${name}__`) fail(`${name} is not a placeholder in deploy/Dockerfile`);

function build(extra) {
    rmSync(NEXT, {recursive: true, force: true});
    const run = spawnSync("npm", ["run", "build"], {cwd: ROOT, env: {...process.env, NEXT_TELEMETRY_DISABLED: "1", ...extra}, stdio: ["ignore", "ignore", "inherit"]});
    if (run.status !== 0) fail("the build failed");
}

function walk(dir) {
    return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
}

const TEXT = /\.(html|js|css|txt|json|xml|webmanifest|map|rsc|body|meta)$/;
const textFiles = (dir) => walk(dir).filter((file) => TEXT.test(file));
const htmlTag = (html) => /<html\b[^>]*>/.exec(html)?.[0] ?? "";

function substitute(dir, values) {
    for (const file of textFiles(dir)) {
        const before = readFileSync(file, "utf8");
        const after = before.replace(/__(NEXT_PUBLIC_[A-Z0-9_]+)__/g, (_, name) => values[name] ?? "");
        if (after !== before) writeFileSync(file, after);
    }
}

function freePort() {
    return new Promise((resolve, reject) => {
        const probe = createServer();
        probe.listen(0, "127.0.0.1", () => {
            const {port} = probe.address();
            probe.close(() => resolve(port));
        });
        probe.on("error", reject);
    });
}

function get(port, path) {
    return new Promise((resolve, reject) => {
        const req = request({host: "127.0.0.1", port, path, headers: {host: HOST}, timeout: 5000}, (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => resolve({status: res.statusCode, body}));
        });
        req.on("timeout", () => req.destroy(new Error("timeout")));
        req.on("error", reject);
        req.end();
    });
}

/** Starts the standalone server of `standalone`, returns the <html> tag of PROBE, stops the server. */
async function renderedHtmlTag(standalone) {
    const port = await freePort();
    const server = spawn("node", ["server.js"], {
        cwd: standalone,
        env: {...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: "production", RENDER_SECRET: "check-cfg-render-secret", NEXT_PUBLIC_DOMAIN: HOST},
        stdio: ["ignore", "ignore", "ignore"],
    });
    try {
        for (let attempt = 0; attempt < 60; attempt += 1) {
            try {
                const {status, body} = await get(port, PROBE);
                if (status !== 200) fail(`${PROBE} answered ${status}`);
                return htmlTag(body);
            } catch (error) {
                if (error instanceof Error && error.message.startsWith("check-cfg")) throw error;
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        fail("the server did not answer");
    } finally {
        server.kill();
    }
    return "";
}

let problems = 0;
const report = (message) => {
    problems += 1;
    console.error(`check-cfg: ${message}`);
};

const rebuild = !process.argv.includes("--no-build");
if (rebuild) build(placeholders);
if (!existsSync(join(NEXT, "standalone/server.js"))) fail("no standalone build in .next/ (run without --no-build)");

// 1. the tokens in the build output; a prerendered page must carry the attributes
const output = [...textFiles(join(NEXT, "server")), ...textFiles(join(NEXT, "static"))];
const bundle = output.map((file) => readFileSync(file, "utf8")).join("\n");
for (const {name} of settings) {
    if (!bundle.includes(`__${name}__`)) report(`the token __${name}__ is not in the built output (folded or lost)`);
}
const prerendered = walk(join(NEXT, "server")).filter((file) => file.endsWith(".html") && !/(_global-error|500)\.html$/.test(file));
for (const page of prerendered) {
    const tag = htmlTag(readFileSync(page, "utf8"));
    for (const {attr, name} of settings) if (!tag.includes(`${attr}="__${name}__"`)) report(`${page.slice(NEXT.length + 1)}: <html> has no ${attr}="__${name}__"`);
}

// 2. the substitution on copies, with all values set and with all empty; a started copy renders the values
const isFlag = (name) => name.endsWith("_SUPPORT");
const valuesSet = Object.fromEntries(settings.map(({name}) => [name, isFlag(name) ? "true" : `https://example.org/${name.toLowerCase()}`]));
const valuesEmpty = Object.fromEntries(settings.map(({name}) => [name, isFlag(name) ? "false" : ""]));
const base = {NEXT_PUBLIC_DOMAIN: HOST, NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.test"};
for (const [label, values] of [["set", valuesSet], ["empty", valuesEmpty]]) {
    const copy = mkdtempSync(join(tmpdir(), "check-cfg-"));
    cpSync(join(NEXT, "standalone"), copy, {recursive: true, dereference: true});
    cpSync(join(NEXT, "static"), join(copy, ".next/static"), {recursive: true});
    substitute(join(copy, ".next"), {...base, ...values});
    const left = textFiles(join(copy, ".next")).filter((file) => /__NEXT_PUBLIC_[A-Z0-9_]+__/.test(readFileSync(file, "utf8")));
    if (left.length > 0) report(`${label} values: a placeholder is left in ${left[0].slice(copy.length + 1)}`);
    const tag = await renderedHtmlTag(copy);
    for (const {attr, name} of settings) {
        if (!tag.includes(`${attr}="${values[name]}"`)) report(`${label} values: the rendered ${PROBE} has no ${attr}="${values[name]}" in <html>`);
    }
    rmSync(copy, {recursive: true, force: true});
}

// 3. a build with empty values keeps the attribute, empty
if (rebuild) {
    build({...Object.fromEntries(Object.keys(placeholders).map((name) => [name, ""])), ...base, ...Object.fromEntries(settings.map(({name}) => [name, ""]))});
    const tag = await renderedHtmlTag(join(NEXT, "standalone"));
    for (const {attr} of settings) if (!tag.includes(`${attr}=""`)) report(`empty build: the rendered ${PROBE} has no ${attr}="" in <html>`);
}

if (problems > 0) fail(`${problems} problem(s)`);
console.log(`check-cfg: ${settings.length} settings: the tokens survive in the build, the substitution gives the values in the rendered <html>, an empty build keeps empty attributes`);
