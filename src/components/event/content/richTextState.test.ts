import {expect, it} from "vitest";
import {emptyRichText, richTextHasContent, richTextPlainText, richTextVariableNames} from "./richTextState";

it("an empty Lexical paragraph is not content", () => {
    expect(richTextHasContent(emptyRichText())).toBe(false);
});

it("an atomic variable alone is content and appears in the summary", () => {
    const value = {root: {type: "root", children: [{type: "paragraph", children: [{type: "variable", varName: "event.name"}]}]}};
    expect(richTextHasContent(value)).toBe(true);
    expect([...richTextVariableNames(value)]).toEqual(["event.name"]);
    expect(richTextPlainText(value, {"event.name": "CTF Day"})).toBe("CTF Day");
});

it("text is copied literally and markup is never interpreted", () => {
    const value = {root: {type: "root", children: [{type: "paragraph", children: [{type: "text", text: "<b>safe text</b>"}]}]}};
    expect(richTextHasContent(value)).toBe(true);
    expect(richTextPlainText(value, {})).toBe("<b>safe text</b>");
});
