/**
 * The optional installation settings stay in step across the places that must name them (README, Configuration → Installation settings):
 * the root layout attributes, the image build, the entrypoint, next.config, the docs, the CI step and the stylesheet.
 */
import {describe, expect, it} from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

function files(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) return files(file);
        return /\.(css|tsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [file] : [];
    });
}

const settingsSource = read("src/utils/settings.ts");
const envNames = [...new Set([...settingsSource.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)].map((m) => m[1]))];
const attrNames = [...settingsSource.matchAll(/"(data-cfg-[a-z-]+)":/g)].map((m) => m[1]);

describe("installation settings parity", () => {
    it("lists a setting once per attribute", () => {
        expect(envNames.length).toBe(attrNames.length);
        expect(envNames.length).toBeGreaterThan(0);
    });

    it.each(envNames)("%s is in the image build, the entrypoint, next.config, .env.example and the README", (name) => {
        expect(read("deploy/Dockerfile")).toContain(`ENV ${name}="__${name}__"`);
        expect(read("deploy/entrypoint.sh")).toContain(name);
        expect(read("next.config.mjs")).toContain(name);
        expect(read(".env.example")).toContain(name);
        expect(read("README.md")).toContain(`\`${name}\``);
    });

    it("has no trace of the removed NEXT_PUBLIC_SHOW_PARTNERS in the build, the entrypoint, the docs or the code", () => {
        for (const file of ["deploy/Dockerfile", "deploy/entrypoint.sh", "README.md", ".env.example"]) expect(read(file), file).not.toContain("SHOW_PARTNERS");
        for (const file of files(path.join(ROOT, "src"))) expect(fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\*|\/\/).*$/gm, ""), file).not.toContain("SHOW_PARTNERS");
    });

    it("sources the rule file in the image and runs the check in CI", () => {
        expect(read("deploy/Dockerfile")).toContain("COPY deploy/cfg-check.sh /usr/local/lib/cfg-check.sh");
        expect(read("deploy/entrypoint.sh")).toContain(". /usr/local/lib/cfg-check.sh");
        expect(read(".github/workflows/test.yml")).toContain("npm run check:cfg");
        expect(read("package.json")).toContain('"check:cfg": "node scripts/check-cfg.mjs"');
    });

    it("passes only required values through a `for name in NEXT_PUBLIC_...` line of the entrypoint (the optional list is a variable)", () => {
        const listed = read("deploy/entrypoint.sh").split("\n").filter((line) => /^for [a-z]+ in NEXT_PUBLIC_/.test(line)).flatMap((line) => line.match(/NEXT_PUBLIC_[A-Z0-9_]+/g) ?? []);
        expect(listed.sort()).toEqual(["NEXT_PUBLIC_SUPPORT_EMAIL"].sort());
    });

    it("keeps every attribute the stylesheet reads in settingsAttrs where the event site reads it, and every cfg class that src uses in the stylesheet", () => {
        const css = read("src/styles/cfg.css");
        // The stylesheet is the one shared file; the attributes this site does not set (terms, privacy) stay absent, which means "empty".
        for (const attr of attrNames) expect(css, attr).toContain(attr);
        const defined = new Set([...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.(cfg-[a-z-]+)/g)].map((m) => m[1]));
        const used = new Set<string>();
        for (const file of files(path.join(ROOT, "src"))) {
            if (file.endsWith("settings.ts")) continue;
            const code = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
            for (const m of code.matchAll(/(?<![\w\-/.])(cfg-[a-z-]+)/g)) used.add(m[1]);
        }
        expect(used.size).toBeGreaterThan(0);
        for (const cls of used) expect(defined.has(cls), cls).toBe(true);
    });

    it("reads a setting outside settings.ts only as the value of an href, as a path prefix of the inbox link, or a plain alias of it (never in a comparison a minifier could fold)", () => {
        const bad: string[] = [];
        for (const file of files(path.join(ROOT, "src"))) {
            if (file.endsWith("settings.ts") || file.endsWith("settingRules.ts")) continue;
            for (const line of fs.readFileSync(file, "utf8").split("\n")) {
                for (const name of envNames) {
                    if (line.includes(`process.env.${name}`) && !new RegExp(`href=\\{process\\.env\\.${name}\\}|otherEventsHref: \`\\$\\{process\\.env\\.${name}\\}/\\?inbox\`|^export const \\w+ = process\\.env\\.${name};?$`).test(line.trim())) bad.push(`${path.relative(ROOT, file)}: ${line.trim()}`);
                }
            }
        }
        expect(bad).toEqual([]);
    });
});
