import {describe, expect, it} from "vitest";
import {emailPreviewDocument} from "./emailPreviewDocument";

describe("email preview document", () => {
    it("puts the rendered fragment on a centred sheet over a mail canvas", () => {
        const html = emailPreviewDocument('<div style="text-align:center"><img src="data:image/png;base64,AA" alt="logo"></div><p>Привіт</p>');
        expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
        expect(html).toContain('<div class="sheet"><div style="text-align:center"><img');
        expect(html).toContain("body{background:#eef0f4");
        expect(html).toContain("max-width:600px;margin:0 auto");
        expect(html).toContain("html,body{margin:0;padding:0}");
    });
});

describe("email preview footer", () => {
    it("keeps the platform footer the server appended, after the message", () => {
        const html = emailPreviewDocument('<p>Текст</p><div style="font-size:12px">Footer: support, privacy</div>');
        expect(html.indexOf("Текст")).toBeLessThan(html.indexOf("Footer: support, privacy"));
        expect(html).toContain('</div></div></body>');
    });
});
