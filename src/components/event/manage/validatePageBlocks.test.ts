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

describe("registration actions and countdown windows", () => {
    it("accepts a button-only registration action and rejects a link without an address", () => {
        const join: ContentBlock = {id: "join", type: "cta", action: {label: "Приєднатися", kind: "join_event"}};
        const link: ContentBlock = {id: "link", type: "cta", action: {label: "Правила", kind: "link"}};
        expect(validateLanding({blocks: [join]}, [])).toBeNull();
        const error = validateLanding({blocks: [link]}, []);
        expect(blockValidationField(error ?? undefined, link)).toBe("action:href");
    });

    it("requires a valid show-from date before a fixed countdown target", () => {
        const block: ContentBlock = {id: "timer", type: "countdown", dateSource: "custom", targetDate: "2026-10-01T12:00:00Z", showFromSource: "custom", showFromDate: "2026-10-02T12:00:00Z"};
        const error = validateLanding({blocks: [block]}, []);
        expect(blockValidationField(error ?? undefined, block)).toBe("showFromDate");
        expect(validateLanding({blocks: [{...block, showFromDate: "2026-09-30T12:00:00Z"}]}, [])).toBeNull();
    });
});

describe("anchors and partners", () => {
    const section = (id: string, anchor?: string): ContentBlock => ({id, type: "section", label: "Правила", anchor});
    it("points anchor problems at the anchor field", () => {
        const second = section("b", "rules");
        const error = validateLanding({blocks: [section("a", "rules"), second]}, []);
        expect(error).toContain("Блок 2: якір:");
        expect(blockValidationField(error ?? undefined, second)).toBe("anchor");
        expect(validateLanding({blocks: [section("a", "rules"), section("b", "faq")]}, [])).toBeNull();
    });

    it("requires named logos with images in every partner group", () => {
        const partners = (groups: ContentBlock["groups"]): ContentBlock => ({id: "p", type: "partners", title: "Партнери", groups});
        expect(validateLanding({blocks: [partners([{title: "", items: [{name: "ХНУРЕ", imageURL: "/api/events/e/content-images/f", href: "https://nure.ua"}]}])]}, [])).toBeNull();
        const empty = partners([{title: "Партнери", items: []}]);
        expect(blockValidationField(validateLanding({blocks: [empty]}, []) ?? undefined, empty)).toBe("groups");
        expect(validateLanding({blocks: [partners([{items: [{name: "", imageURL: "x"}]}])]}, [])).toContain("назву");
        expect(validateLanding({blocks: [partners([{items: [{name: "A", imageURL: ""}]}])]}, [])).toContain("файл");
        expect(validateLanding({blocks: [partners([{items: [{name: "A", imageURL: "x", href: "javascript:alert(1)"}]}])]}, [])).toContain("HTTPS");
    });
});
