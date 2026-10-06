import {describe, expect, it, vi} from "vitest";
import {ApiErrorCode} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {attachmentActionError, infrastructureMismatch, attachmentKind, attachmentScopeLabel, attachmentVersionLabel, detachWithConfirm, exercisesAppURL, hintCostChanges, hintCostDraftValid, runningStandTeams} from "./attachmentModel";

const hint = (patch: Partial<{ID: string; Cost: number; Overridden: boolean}>) => ({ID: "h", Text: "", Level: "nudge" as const, Cost: 10, Overridden: false, ...patch});

describe("attachment labels", () => {
    it("uses the catalog version number, not the event revision", () => {
        expect(attachmentVersionLabel({VersionNumber: 4, Revision: 9} as never)).toBe("версія 4");
    });

    it("names the scope: catalog, the event's copy, or the event's own exercise", () => {
        const fork = {SourceExerciseID: "s"} as never;
        expect(attachmentScopeLabel(attachmentKind({Scope: "catalog", Fork: null}))).toBe("Каталог");
        expect(attachmentScopeLabel(attachmentKind({Scope: "event", Fork: fork}))).toBe("Копія заходу");
        expect(attachmentScopeLabel(attachmentKind({Scope: "event", Fork: null}))).toBe("Завдання заходу");
    });
});

describe("exercises app links", () => {
    it("carries the exercise, the event and the encoded return URL", () => {
        const url = exercisesAppURL("https://exercises.cybericebox.local", "detail", {exerciseID: "ex-1", eventID: "ev-1", returnURL: "https://arena.cybericebox.local/manage/exercises?tab=sets"});
        expect(url).toBe("https://exercises.cybericebox.local/detail?id=ex-1&event=ev-1&return_to=https%3A%2F%2Farena.cybericebox.local%2Fmanage%2Fexercises%3Ftab%3Dsets");
        expect(new URL(url).searchParams.get("return_to")).toBe("https://arena.cybericebox.local/manage/exercises?tab=sets");
        expect(exercisesAppURL("https://exercises.d.local", "new", {eventID: "ev-1", returnURL: "x"})).toBe("https://exercises.d.local/new?event=ev-1&return_to=x");
    });
});

describe("hint cost drafts", () => {
    it("sends overrides, resets empty fields to the default and skips unchanged ones", () => {
        const hints = [hint({ID: "a"}), hint({ID: "b", Cost: 5, Overridden: true}), hint({ID: "c"})];
        expect(hintCostChanges(hints, {a: "25", b: "", c: "10"})).toEqual([{HintID: "a", Cost: 25}, {HintID: "b", Cost: null}]);
        expect(hintCostChanges(hints, {})).toEqual([]);
    });

    it("accepts whole costs from 0 to 10000 or an empty field", () => {
        expect(["", "0", "10000", " 7 "].every(hintCostDraftValid)).toBe(true);
        expect(["-1", "10001", "1.5", "abc"].some(hintCostDraftValid)).toBe(false);
    });
});

describe("detach flow", () => {
    it("asks for confirmation when the server reports attempts", async () => {
        const detach = vi.fn(async (confirm: boolean) => { if (!confirm) throw new ManageApiError(409, ApiErrorCode.ExerciseDetachNeedsConfirm); });
        expect(await detachWithConfirm(detach, false)).toBe("needs-confirm");
        expect(await detachWithConfirm(detach, true)).toBe("detached");
        expect(detach.mock.calls).toEqual([[false], [true]]);
    });

    it("passes other failures through", async () => {
        await expect(detachWithConfirm(async () => { throw new ManageApiError(500); }, false)).rejects.toBeInstanceOf(ManageApiError);
    });

    it("reads the teams of a running-stage conflict", () => {
        const teams = [{ID: "t1", Name: "Red"}];
        expect(runningStandTeams(new ManageApiError(409, ApiErrorCode.ExerciseStandsRunning, undefined, {teams}))).toEqual(teams);
        expect(runningStandTeams(new ManageApiError(409, ApiErrorCode.ExerciseStandsRunning))).toEqual([]);
        expect(runningStandTeams(new ManageApiError(409, ApiErrorCode.ExerciseTaskHasAttempts))).toBeNull();
        expect(runningStandTeams(new Error("boom"))).toBeNull();
    });

    it("explains a refused update", () => {
        expect(attachmentActionError(new ManageApiError(409, ApiErrorCode.ExerciseTaskHasAttempts), "x")).toContain("вже розвʼязували");
        expect(attachmentActionError(new Error("boom"), "fallback")).toBe("fallback");
    });

    it("flags a set that needs infrastructure on an event without it", () => {
        expect(infrastructureMismatch({Infrastructure: true}, false)).toBe(true);
        expect(infrastructureMismatch({Infrastructure: true}, true)).toBe(false);
        expect(infrastructureMismatch({Infrastructure: false}, false)).toBe(false);
    });
});
