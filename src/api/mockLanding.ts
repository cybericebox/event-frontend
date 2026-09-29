import {plainTextRichText} from "@/components/event/content/richTextState";
import {ContentDocumentSchema, type ContentDocument} from "@/types/eventContent";

const key = "cybericebox-event-mock-landing";

export function mockLandingSnapshot(): string | null {
    if (typeof window === "undefined") return null;
    try {return window.localStorage.getItem(key);} catch {return null;}
}

export const defaultMockLanding: ContentDocument = {blocks: [
    {id: "intro", type: "section", label: "Про подію"},
    {id: "description", type: "text", richText: plainTextRichText("Командне змагання з кібербезпеки на CyberICEBox. Розв'язуйте завдання, співпрацюйте з командою та стежте за результатами.")},
]};

export function readMockLanding(fallback: ContentDocument): ContentDocument {
    if (typeof window === "undefined") return fallback;
    try {
        const saved = mockLandingSnapshot();
        return saved ? ContentDocumentSchema.parse(JSON.parse(saved)) : fallback;
    } catch {
        return fallback;
    }
}

export function writeMockLanding(document: ContentDocument): void {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(document));
}

const draftKey = "cybericebox-event-mock-landing-draft";
let memoryDraft: ContentDocument | null = null;

// The saved, unpublished landing of mock mode (survives reloads in the browser).
export function readMockLandingDraft(): ContentDocument | null {
    if (typeof window === "undefined") return memoryDraft;
    try {
        const saved = window.localStorage.getItem(draftKey);
        return saved ? ContentDocumentSchema.parse(JSON.parse(saved)) : null;
    } catch {
        return memoryDraft;
    }
}

export function writeMockLandingDraft(document: ContentDocument | null): void {
    memoryDraft = document;
    if (typeof window === "undefined") return;
    try {
        if (document) window.localStorage.setItem(draftKey, JSON.stringify(document));
        else window.localStorage.removeItem(draftKey);
    } catch {
        // Private mode: keep the in-memory draft only.
    }
}
