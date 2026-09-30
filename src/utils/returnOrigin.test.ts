import {describe, expect, it} from "vitest";
import {readAdminReturn, validAdminReturn, withManageOrigin} from "./returnOrigin";

const ADMIN = "https://admin.example.org";
const store = (initial?: string) => {
    const data = new Map<string, string>(initial ? [["cib_return_admin", initial]] : []);
    return {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value)};
};

describe("admin return origin", () => {
    it("accepts only our admin host over https", () => {
        expect(validAdminReturn(`${ADMIN}/events?x=1#top`, ADMIN)).toBe(`${ADMIN}/events?x=1`);
        for (const bad of ["https://evil.example.com/events", "http://admin.example.org/", "https://admin.example.org.evil.com/", "https://u:p@admin.example.org/", "javascript:alert(1)", "//evil.com", "", null])
            expect(validAdminReturn(bad, ADMIN)).toBeNull();
        expect(validAdminReturn(`${ADMIN}/events`, "")).toBeNull();
    });

    it("remembers a valid origin from the address and falls back to the session", () => {
        const storage = store();
        expect(readAdminReturn(`?from=${encodeURIComponent(`${ADMIN}/events`)}`, storage, ADMIN)).toBe(`${ADMIN}/events`);
        expect(readAdminReturn("", storage, ADMIN)).toBe(`${ADMIN}/events`);
    });

    it("ignores an invalid origin in the address and in the session", () => {
        expect(readAdminReturn(`?from=${encodeURIComponent("https://evil.com/")}`, store(), ADMIN)).toBeNull();
        expect(readAdminReturn("", store("https://evil.com/"), ADMIN)).toBeNull();
        expect(readAdminReturn("", null, ADMIN)).toBeNull();
    });

    it("adds the manage page and event name to an admin link", () => {
        const href = withManageOrigin(ADMIN, "https://ctf.example.org/manage/labs", "CTF 2027");
        const params = new URL(href).searchParams;
        expect(params.get("from")).toBe("https://ctf.example.org/manage/labs");
        expect(params.get("from_name")).toBe("CTF 2027");
    });
});
