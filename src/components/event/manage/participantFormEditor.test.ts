import {describe, expect, it} from "vitest";
import {validateParticipantForm} from "./participantFormEditor";
import {emptyRichText} from "../content/richTextState";

describe("formatted text in forms and surveys", () => {
    it("requires content in a Lexical text block", () => {
        expect(validateParticipantForm({blocks: [{id: "text", type: "text", richText: emptyRichText()}]})).toBe("Блок 1: додайте текст.");
    });
    it("accepts saved Lexical text", () => {
        expect(validateParticipantForm({blocks: [{id: "text", type: "text", richText: {root: {type: "root", version: 1, children: [{type: "paragraph", version: 1, children: [{type: "text", version: 1, text: "Правила"}]}]}}}]})).toBeNull();
    });
});
