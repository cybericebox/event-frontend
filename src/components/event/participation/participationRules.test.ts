import {describe, expect, it} from "vitest";
import {participationSchema} from "@/api/clientAuth";
import {reasonText, simulatedNeedsConfirmation} from "./participationRules";

describe("reasonText", () => {
    it("has a message for every team formation reason", () => {
        for (const code of ["team_formed", "team_switch_locked", "forms_at_start", "team_not_formed", "below_minimum"]) {
            expect(reasonText(code)).not.toBe("");
            expect(reasonText(code)).not.toContain("participation.reason");
        }
    });

    it("stays empty for no reason and for codes this site does not know", () => {
        expect(reasonText("")).toBe("");
        expect(reasonText("something_new")).toBe("");
    });
});

describe("participation block", () => {
    it("carries the formation capabilities and reasons", () => {
        const block = participationSchema.parse({
            Phase: "started", TeamFormed: true, DisbandTeam: {Allowed: false, Reason: "team_switch_locked"}, FormTeam: {Allowed: false, Reason: "team_formed"},
            RemoveMember: {Allowed: true, Reason: ""}, SeeTasks: {Allowed: false, Reason: "team_not_formed"},
        });
        expect(block.TeamFormed).toBe(true);
        expect(block.RemoveMember.Allowed).toBe(true);
        expect(reasonText(block.DisbandTeam.Reason)).toBe(reasonText("team_switch_locked"));
        expect(reasonText(block.FormTeam.Reason)).toBe(reasonText("team_formed"));
        expect(reasonText(block.SeeTasks.Reason)).toBe(reasonText("team_not_formed"));
    });

    it("leaves formation closed when the server sends nothing", () => {
        const block = participationSchema.parse({Phase: "started"});
        expect(block.TeamFormed).toBe(false);
        expect(block.FormTeam.Allowed).toBe(false);
    });
});

describe("simulatedNeedsConfirmation", () => {
    it("asks only for an unformed team of a rolling event", () => {
        expect(simulatedNeedsConfirmation(false, 1)).toBe(true);
        expect(simulatedNeedsConfirmation(false, 0)).toBe(false);
        expect(simulatedNeedsConfirmation(false, undefined)).toBe(false);
        expect(simulatedNeedsConfirmation(true, 1)).toBe(false);
    });
});
