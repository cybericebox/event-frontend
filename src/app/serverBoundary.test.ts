import {readdirSync, readFileSync, statSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {expect, it} from "vitest";

// A server module may import only components (rendered or passed as props) from a "use client" module; calling any
// other export on the server fails at runtime ("Attempted to call X() from the server"), which unit tests with
// plain imports never notice. Pure helpers shared by both sides live in modules without the directive.
const root = resolve(__dirname, "..");
const isClient = (file: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(readFileSync(file, "utf8"));
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
});
function resolveImport(from: string, spec: string): string | null {
    const base = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
    if (!base) return null;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
        try {if (statSync(candidate).isFile()) return candidate;} catch {/* next */}
    }
    return null;
}

it("no server module calls a value exported by a use client module", () => {
    const files = walk(root);
    const clients = new Set(files.filter(isClient));
    // Server code: route entry files and API readers that use server-only facilities.
    const serverApi = (file: string) => /[/\\]api[/\\]/.test(file) && /next\/headers|server-only|from "react"/.test(readFileSync(file, "utf8"));
    const servers = files.filter(file => !clients.has(file) && (/[/\\]app[/\\](?:.*[/\\])?(?:layout|page|route|not-found|global-error)\.tsx?$/.test(file) || serverApi(file)));
    const offences: string[] = [];
    for (const file of servers) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(/import\s+(?!type\b)\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) {
            const target = resolveImport(file, match[2]);
            if (!target || !clients.has(target)) continue;
            for (const part of match[1].split(",")) {
                const name = part.trim().split(/\s+as\s+/)[0].trim();
                if (name && !/^[A-Z]/.test(name)) offences.push(`${file.slice(root.length + 1)} imports ${name} from ${target.slice(root.length + 1)}`);
            }
        }
    }
    expect(offences).toEqual([]);
});

it("resolveEventLogoURL lives in a module without the use client directive", () => {
    expect(isClient(join(root, "utils", "eventLogoURL.ts"))).toBe(false);
});
