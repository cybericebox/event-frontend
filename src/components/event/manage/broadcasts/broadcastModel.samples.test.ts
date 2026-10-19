// @vitest-environment jsdom
import {describe, expect, it} from "vitest";
import {broadcastSampleValues} from "./broadcastModel";

describe("broadcast preview samples", () => {
    it("use the event's own name and site; only the recipient is a placeholder", () => {
        const values = broadcastSampleValues("Kharkiv Regional CTF");
        expect(values.event_name).toBe("Kharkiv Regional CTF");
        expect(values.event_url).toBe(`${window.location.origin}/`);
        expect(values.user_email).toBe(`participant@${window.location.hostname}`);
        expect(values.user_name).toBe("Імʼя учасника");
        expect(Object.values(values).join(" ")).not.toContain("example.com");
    });
});
