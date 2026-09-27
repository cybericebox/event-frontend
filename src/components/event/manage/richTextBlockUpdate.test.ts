import {describe, expect, it} from "vitest";
import {updateBlockRichText} from "./richTextBlockUpdate";
import {emptyRichText} from "../content/richTextState";
import type {ContentBlock} from "../../../types/eventContent";

const withVariable = {root: {type: "root" as const, version: 1, children: [{type: "paragraph", version: 1, children: [{type: "variable", version: 1, varName: "event.startAt"}]}]}};
const catalog = [{name: "event.startAt", label: "Початок", format: "date-time" as const, audience: 0 as const}];

describe("updating a formatted page field", () => {
    it("adds the binding and keeps that field's date format", () => {
        const block: ContentBlock = {id: "text", type: "text", richText: emptyRichText(), dateDisplays: {richText: {"event.startAt": {format: "custom", pattern: "HH:mm:ss"}}}};
        const next = updateBlockRichText(block, "richText", withVariable, catalog);
        expect(next.variables).toEqual([{name: "event.startAt", format: "date-time"}]);
        expect(next.dateDisplays?.richText["event.startAt"].pattern).toBe("HH:mm:ss");
    });
    it("removes only the stale format from the edited item", () => {
        const block: ContentBlock = {id: "faq", type: "faq", items: [{label: "Час?", richText: withVariable}], dateDisplays: {"item:0:richText": {"event.startAt": {format: "time"}}, title: {"event.startAt": {format: "date"}}}};
        const next = updateBlockRichText(block, "item:0:richText", emptyRichText(), catalog);
        expect(next.dateDisplays?.["item:0:richText"]).toEqual({});
        expect(next.dateDisplays?.title["event.startAt"].format).toBe("date");
    });
});
