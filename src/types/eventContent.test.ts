import {expect, it} from "vitest";
import {ContentBlockSchema, ContentDocumentSchema} from "./eventContent";

it("content schema keeps the complete Lexical document", () => {
    const richText = {root: {type: "root", version: 1, direction: null, children: [{type: "paragraph", version: 1, format: "center", children: [{type: "text", version: 1, text: "Hello", format: 1}]}]}};
    const parsed = ContentBlockSchema.parse({id: "body", type: "text", richText});
    expect(parsed.richText).toEqual(richText);
});

it("moves saved countdown buttons into an editable standalone action block", () => {
    const document = ContentDocumentSchema.parse({blocks: [{id: "timer", type: "countdown", title: "До початку", targetDate: "2026-09-28T10:00:00Z", action: {label: "Приєднатися", href: "/join"}}]});
    expect(document.blocks.map(block => block.type)).toEqual(["countdown", "cta"]);
    expect(document.blocks[0].action).toBeUndefined();
    expect(document.blocks[1].action).toEqual({label: "Приєднатися", href: "/join"});
    expect(document.blocks[1].id).toBe("timer-action");
});
