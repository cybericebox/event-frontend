import {describe, expect, it} from "vitest";
import {fillSamples, insertAtCaret, orderedVersions, sampleValues, templateMode, variableToken} from "./notificationModel";

const version = (Status: "draft" | "published" | "unpublished", UpdatedAt: string, NotificationType = "a") => ({NotificationType, Status, UpdatedAt});

describe("template modes", () => {
    it("tells what the right side shows", () => {
        expect(templateMode(undefined)).toBe("none");
        expect(templateMode({Source: "platform", Status: "published"})).toBe("platform");
        expect(templateMode({Source: "event", Status: "draft"})).toBe("edit");
        expect(templateMode({Source: "event", Status: "published"})).toBe("view");
        expect(templateMode({Source: "event", Status: "unpublished"})).toBe("previous");
    });

    it("orders a draft first, then published, then older, newest first", () => {
        const items = [version("unpublished", "2026-01-01"), version("published", "2026-02-01"), version("unpublished", "2026-03-01"), version("draft", "2026-01-15"), version("draft", "2026-01-01", "b")];
        expect(orderedVersions(items, "a").map(item => `${item.Status}:${item.UpdatedAt}`)).toEqual([
            "draft:2026-01-15", "published:2026-02-01", "unpublished:2026-03-01", "unpublished:2026-01-01",
        ]);
    });
});

describe("sample values", () => {
    it("uses the catalog defaults and the event name", () => {
        const values = sampleValues({Type: "x", Channels: ["email"], Variables: [{Name: "event_name", Description: "", Default: "Захід"}, {Name: "start_at", Description: "", Default: "01.01.2027 10:00"}]}, "CTF 2027");
        expect(values).toEqual({event_name: "CTF 2027", start_at: "01.01.2027 10:00"});
        expect(sampleValues(undefined, "CTF")).toEqual({event_name: "CTF"});
    });

    it("fills both variable spellings and escapes html values", () => {
        expect(fillSamples("{{.event_name}} / {{ start_at }} / {{.missing}}", {event_name: "A", start_at: "B"})).toBe("A / B / ");
        expect(fillSamples("<b>{{.x}}</b>", {x: "<i>&"}, true)).toBe("<b>&lt;i&gt;&amp;</b>");
    });
});

describe("variable insertion", () => {
    it("inserts at the caret, replacing a selection", () => {
        expect(insertAtCaret("Hello world", "{{.x}}", 6, 11)).toEqual({value: "Hello {{.x}}", caret: 12});
        expect(insertAtCaret("ab", "X", null, null)).toEqual({value: "abX", caret: 3});
        expect(variableToken("event_name")).toBe("{{.event_name}}");
    });
});
