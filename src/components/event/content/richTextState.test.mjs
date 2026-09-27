import test from "node:test";
import assert from "node:assert/strict";
import {emptyRichText, richTextHasContent, richTextPlainText, richTextVariableNames} from "./richTextState.ts";

test("an empty Lexical paragraph is not content", () => {
    assert.equal(richTextHasContent(emptyRichText()), false);
});

test("an atomic variable alone is content and appears in the summary", () => {
    const value = {root: {type: "root", children: [{type: "paragraph", children: [{type: "variable", varName: "event.name"}]}]}};
    assert.equal(richTextHasContent(value), true);
    assert.deepEqual([...richTextVariableNames(value)], ["event.name"]);
    assert.equal(richTextPlainText(value, {"event.name": "CTF Day"}), "CTF Day");
});

test("text is copied literally and markup is never interpreted", () => {
    const value = {root: {type: "root", children: [{type: "paragraph", children: [{type: "text", text: "<b>safe text</b>"}]}]}};
    assert.equal(richTextHasContent(value), true);
    assert.equal(richTextPlainText(value, {}), "<b>safe text</b>");
});
