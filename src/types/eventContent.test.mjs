import test from "node:test";
import assert from "node:assert/strict";
import {ContentBlockSchema} from "./eventContent.ts";

test("content schema keeps the complete Lexical document", () => {
    const richText = {root: {type: "root", version: 1, direction: null, children: [{type: "paragraph", version: 1, format: "center", children: [{type: "text", version: 1, text: "Hello", format: 1}]}]}};
    const parsed = ContentBlockSchema.parse({id: "body", type: "text", richText});
    assert.deepEqual(parsed.richText, richText);
});
