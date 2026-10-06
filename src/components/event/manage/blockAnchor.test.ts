import {describe, expect, it} from "vitest";
import {anchorError, anchorFromText} from "./blockAnchor";

describe("block anchors", () => {
    it("builds a readable anchor from a Ukrainian heading", () => {
        expect(anchorFromText("Правила змагання")).toBe("pravyla-zmahannia");
        expect(anchorFromText("  Розклад дня 2026! ")).toBe("rozklad-dnia-2026");
        expect(anchorFromText("{{event.name}}: фінал")).toBe("final");
        expect(anchorFromText("Щедрість і ґанок")).toBe("shchedrist-i-ganok");
    });

    it("rejects malformed and repeated anchors", () => {
        expect(anchorError("", ["rules"])).toBeNull();
        expect(anchorError("rules", ["faq"])).toBeNull();
        expect(anchorError("rules", ["rules"])).toContain("уже є");
        expect(anchorError("Rules", [])).not.toBeNull();
        expect(anchorError("my rules", [])).not.toBeNull();
        expect(anchorError("a".repeat(65), [])).not.toBeNull();
    });
});
