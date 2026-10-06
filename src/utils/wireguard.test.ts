import {describe, expect, it} from "vitest";
import {eventVpnFileName, wireguardFileName} from "./wireguard";

const valid = (file: string) => /^[a-zA-Z0-9_=+.-]{1,15}\.conf$/.test(file);

describe("wireguard file names", () => {
    it("names an event config after the event tag", () => {
        expect(eventVpnFileName("autumnctf")).toBe("autumnctf.conf");
    });
    it("cuts a long tag to the 15 characters wg-quick allows", () => {
        const file = eventVpnFileName("cybersecuritychampionship2026");
        expect(file).toBe("cybersecuritych.conf");
        expect(valid(file)).toBe(true);
    });
    it("replaces invalid characters and never returns an empty name", () => {
        expect(valid(wireguardFileName("тег заходу"))).toBe(true);
        expect(wireguardFileName("")).toBe("wg0.conf");
    });
});
