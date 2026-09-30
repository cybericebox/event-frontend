import {describe, expect, it} from "vitest";
import {MODERATORS_VPN_FILE, PARTICIPANT_VPN_FILE, wireguardFileName} from "./wireguard";

const valid = (file: string) => /^[a-zA-Z0-9_=+.-]{1,15}\.conf$/.test(file);

describe("wireguardFileName", () => {
    it("keeps the name wg-quick accepts", () => {
        expect(PARTICIPANT_VPN_FILE).toBe("cybericebox.conf");
        expect(MODERATORS_VPN_FILE).toBe("cybericebox-mod.conf");
        expect(valid(PARTICIPANT_VPN_FILE) && valid(MODERATORS_VPN_FILE)).toBe(true);
    });
    it("cuts long names to 15 characters and replaces invalid characters", () => {
        expect(valid(wireguardFileName("a-very-long-event-tag-moderators"))).toBe(true);
        expect(wireguardFileName("тег заходу")).toMatch(/^[-a-zA-Z0-9_=+.]*\.conf$/);
        expect(wireguardFileName("")).toBe("wg0.conf");
    });
});
