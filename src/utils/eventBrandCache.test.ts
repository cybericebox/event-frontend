// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {FAVICON_BOOT_SCRIPT, writeCachedBrand} from "./eventBrandCache";

afterEach(() => {window.localStorage.clear(); document.head.innerHTML = "";});

describe("favicon boot script", () => {
    it("is plain script text with the storage key spelled out as a literal", () => {
        expect(FAVICON_BOOT_SCRIPT).not.toMatch(/<\/?script/i);
        expect(FAVICON_BOOT_SCRIPT).toContain('"cib:event-favicon:"');
    });
    it("reads the key that writeCachedBrand writes", () => {
        writeCachedBrand({logo: "", favicon: "https://api.test/f.png"});
        document.head.innerHTML = '<link rel="icon" href="/platform.ico">';
        new Function(FAVICON_BOOT_SCRIPT)();
        expect(document.head.querySelector("link")?.getAttribute("href")).toBe("https://api.test/f.png");
    });
});
