import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, it} from "vitest";

// The grant form of a lab device is posted cross-site. With "no-referrer" the browser sends "Origin: null" and the lab
// proxy (which requires the platform Origin) refuses every grant. Only the screen-link page may send no referrer.
function files(dir: string): string[] {
    return readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
}

it("no page or layout other than /live sets a no-referrer policy", () => {
    const offenders = files(__dirname)
        .filter(file => /\.(ts|tsx)$/.test(file) && !/\.test\./.test(file) && !file.includes(`${join("app", "live")}`) && !file.endsWith(join("app", "live", "page.tsx")))
        .filter(file => /referrer\s*:\s*["']no-referrer["']|name=["']referrer["']/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
});
