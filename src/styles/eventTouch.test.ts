import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";

const css = readFileSync(resolve(import.meta.dirname, "event-touch.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("touch styles", () => {
    it("set 16px on the editable root only, never on the headings or lists inside a rich-text editor", () => {
        const rule = css.match(/([^{}]*\[contenteditable="true"\][^{}]*)\{font-size:16px\}/);
        expect(rule).not.toBeNull();
        expect(rule![1]).not.toMatch(/\[contenteditable="true"\]\s+[^,]/);
        expect(css).not.toMatch(/contenteditable[^{]*\b(h[1-6]|li|blockquote)\b/);
    });

    it("live under the coarse-pointer query, so a mouse desktop is unchanged", () => {
        expect(css.trim().startsWith("@media (pointer:coarse){")).toBe(true);
        expect(css.match(/@media/g)).toHaveLength(1);
    });
});
