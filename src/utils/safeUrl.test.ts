import {describe, expect, it} from "vitest";
import {safeLinkHref, safeMediaSrc} from "./safeUrl";

const web = {schemes: ["https:", "http:"]} as const;

describe("safeLinkHref", () => {
    it("keeps site paths, anchors and allowed absolute addresses", () => {
        expect(safeLinkHref("/manage/x?y=1#z", web)).toBe("/manage/x?y=1#z");
        expect(safeLinkHref(" https://example.org/a ", web)).toBe("https://example.org/a");
        expect(safeLinkHref("http://lab.local:8080/", web)).toBe("http://lab.local:8080/");
        expect(safeLinkHref("#top", {...web, anchors: true})).toBe("#top");
        expect(safeLinkHref("mailto:a@b.c", {schemes: ["mailto:"]})).toBe("mailto:a@b.c");
    });
    it("refuses every way to leave the site through a relative-looking address", () => {
        for (const value of ["//evil.example", "/\\evil.example", "\\\\evil.example", "/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/ /evil.example", "/\u0000/evil.example"]) {
            expect(safeLinkHref(value, web), JSON.stringify(value)).toBeNull();
        }
    });
    it("refuses dangerous or unlisted schemes, credentials and junk", () => {
        for (const value of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "data:text/html,<b>", "vbscript:x", "file:///etc/passwd", "ftp://x.example", "https://user:pw@example.org/", "https://", "", "   ", "#top"]) {
            expect(safeLinkHref(value, web), JSON.stringify(value)).toBeNull();
        }
        expect(safeLinkHref("mailto:a@b.c", web)).toBeNull();
        expect(safeLinkHref("http://x.example/", {schemes: ["https:"]})).toBeNull();
        expect(safeLinkHref(undefined, web)).toBeNull();
    });
});

describe("safeMediaSrc", () => {
    it("allows a local preview, a site path and a web address only", () => {
        expect(safeMediaSrc("blob:http://localhost:3003/6f1c")).toBe("blob:http://localhost:3003/6f1c");
        expect(safeMediaSrc("/api/events/e1/logo.png")).toBe("/api/events/e1/logo.png");
        expect(safeMediaSrc("https://api.example.org/api/events/e1/logo.png")).toBe("https://api.example.org/api/events/e1/logo.png");
        expect(safeMediaSrc("")).toBe("");
    });
    it("drops everything else to an empty source", () => {
        for (const value of ["javascript:alert(1)", "data:image/svg+xml,<svg onload=alert(1)>", "//evil.example/x.png", "/\\evil.example/x.png", "vbscript:x", "https://u:p@example.org/x.png"]) {
            expect(safeMediaSrc(value), value).toBe("");
        }
    });
});
