import {describe, expect, it} from "vitest";
import {inboxQuery} from "./inbox";

describe("inbox query", () => {
    it("scopes the inbox to the current event", () => {
        expect(inboxQuery(undefined)).toBe("");
        expect(inboxQuery("e1")).toBe("?event=e1");
        expect(inboxQuery("e1", {since_id: "i", since_at: "t"})).toBe("?since_id=i&since_at=t&event=e1");
    });
});
