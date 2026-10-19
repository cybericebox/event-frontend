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

it("round-trips responsive layout settings including explicit zero spacing", () => {
    const block = {id: "body", type: "text", spacing: {desktop: {top: 0, bottom: 24, inline: 48}, mobile: {top: 8, inline: 0}}, maxWidth: 960, contentAlign: "center", textColumns: 2};
    expect(ContentBlockSchema.parse(block)).toEqual(block);
    expect(ContentBlockSchema.parse({id: "banner", type: "banner", mobileFullWidth: true}).mobileFullWidth).toBe(true);
});

it("rejects invalid layout settings instead of silently dropping them", () => {
    for (const layout of [{spacing: {desktop: {top: -1}}}, {spacing: {mobile: {inline: 161}}}, {spacing: {desktop: {bottom: 2.5}}}, {maxWidth: 0}, {contentAlign: "diagonal"}, {textColumns: 3}]) {
        expect(ContentBlockSchema.safeParse({id: "body", type: "text", ...layout}).success).toBe(false);
    }
    expect(ContentBlockSchema.parse({id: "old", type: "text"})).toEqual({id: "old", type: "text"});
});

it("rejects layout options on incompatible block types", () => {
    expect(ContentBlockSchema.safeParse({id:"b",type:"banner",textColumns:2}).success).toBe(false);
    expect(ContentBlockSchema.safeParse({id:"t",type:"text",mobileFullWidth:true}).success).toBe(false);
});
