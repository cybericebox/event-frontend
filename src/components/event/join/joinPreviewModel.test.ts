import {expect, it} from "vitest";
import {defaultOutcome, nextStep} from "./joinPreviewModel";

it("ends an open or invited registration approved and an approval one pending", () => {
    expect(defaultOutcome(2)).toBe("approved");
    expect(defaultOutcome(0)).toBe("approved");
    expect(defaultOutcome(1)).toBe("pending");
});

it("offers the team only to an approved participant of a team event", () => {
    expect(nextStep("form", {outcome: "approved", teamMode: true})).toBe("result");
    expect(nextStep("result", {outcome: "approved", teamMode: true})).toBe("team");
    expect(nextStep("result", {outcome: "pending", teamMode: true})).toBe("done");
    expect(nextStep("result", {outcome: "approved", teamMode: false})).toBe("done");
    expect(nextStep("team", {outcome: "approved", teamMode: true})).toBe("done");
});
