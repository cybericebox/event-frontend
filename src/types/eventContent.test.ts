import {expect, it} from "vitest";
import {ContentDocumentSchema} from "./eventContent";

it("moves saved countdown buttons into an editable standalone action block", () => {
    const document = ContentDocumentSchema.parse({blocks: [{id: "timer", type: "countdown", title: "До початку", targetDate: "2026-09-28T10:00:00Z", action: {label: "Приєднатися", href: "/join"}}]});
    expect(document.blocks.map(block => block.type)).toEqual(["countdown", "cta"]);
    expect(document.blocks[0].action).toBeUndefined();
    expect(document.blocks[1].action).toEqual({label: "Приєднатися", href: "/join"});
    expect(document.blocks[1].id).toBe("timer-action");
});
