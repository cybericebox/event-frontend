import {describe, expect, it} from "vitest";
import {validateLanding, blockValidationField} from "./validatePageBlocks";
import {emptyRichText} from "../content/richTextState";
import type {ContentBlock} from "../../../types/eventContent";

const textBlock = (richText: ContentBlock["richText"]): ContentBlock => ({id: "text-1", type: "text", richText});

describe("Lexical content validation", () => {
    it("rejects empty formatted text at the editor field", () => {
        const block = textBlock(emptyRichText());
        const error = validateLanding({blocks: [block]}, []);
        expect(error).toBe("Блок 1: заповніть текст.");
        expect(blockValidationField(error ?? undefined, block)).toBe("richText");
    });
    it("requires FAQ answers and document sections to have rich content", () => {
        const faq: ContentBlock = {id: "faq", type: "faq", items: [{label: "Питання", richText: emptyRichText()}]};
        const doc: ContentBlock = {id: "doc", type: "doc", items: [{label: "Розділ", richText: emptyRichText()}]};
        const faqError = validateLanding({blocks: [faq]}, []);
        const docError = validateLanding({blocks: [doc]}, []);
        expect(blockValidationField(faqError ?? undefined, faq)).toBe("item:0:richText");
        expect(blockValidationField(docError ?? undefined, doc)).toBe("item:0:richText");
    });
    it("accepts a variable-only paragraph with a declared binding", () => {
        const block = textBlock({root: {type: "root", version: 1, children: [{type: "paragraph", version: 1, children: [{type: "variable", version: 1, varName: "event.name"}]}]}});
        block.variables = [{name: "event.name", format: "text"}];
        expect(validateLanding({blocks: [block]}, [{name: "event.name", label: "Назва", format: "text", audience: 0}])).toBeNull();
    });
});
