import {describe, expect, it} from "vitest";
import type {ManageStage} from "@/api/manageStages";
import {draftOfStage, isoOf, localDateTime, shortBreaks, stageDirty, stageLocks} from "./stagesModel";

const stage = (extra: Partial<ManageStage> = {}): ManageStage => ({
    ID: "11111111-1111-4111-8111-111111111111", Name: "Етап", OpensAt: "2026-10-01T10:00:00Z", ClosesAt: "2026-10-01T12:00:00Z", Returnable: false,
    LabRetentionMinutes: null, State: "upcoming", First: false, Last: false, DeployLeadMinutes: 0, ...extra,
});

describe("stage locks", () => {
    it("upcoming: everything except the event's own anchors", () => {
        expect(stageLocks(stage())).toEqual({name: false, opens: false, closes: false, returnable: false, canClose: false, canDelete: true});
        expect(stageLocks(stage({First: true, Last: true}))).toMatchObject({opens: true, closes: true});
    });
    it("open: the start is locked, the rest edits, «Закрити зараз» is offered, it is never deletable", () => {
        expect(stageLocks(stage({State: "open"}))).toEqual({name: false, opens: true, closes: false, returnable: false, canClose: true, canDelete: false});
    });
    it("closed: only the name edits", () => {
        expect(stageLocks(stage({State: "closed"}))).toEqual({name: false, opens: true, closes: true, returnable: true, canClose: false, canDelete: false});
    });
});

describe("stage drafts", () => {
    it("round-trips the local datetime and tells a change", () => {
        const value = stage();
        const draft = draftOfStage(value);
        expect(draft.OpensAt).toBe(localDateTime(value.OpensAt));
        expect(stageDirty(value, draft)).toBe(false);
        expect(stageDirty(value, {...draft, Name: "Інше"})).toBe(true);
        expect(isoOf(draft.OpensAt)).toBe(new Date(draft.OpensAt).toISOString());
        expect(isoOf("")).toBeNull();
    });
});

describe("short breaks", () => {
    it("flags a break shorter than the lead of the stage after it", () => {
        const first = stage({ClosesAt: "2026-10-01T12:00:00Z"});
        const next = stage({ID: "22222222-2222-4222-8222-222222222222", Name: "Другий", OpensAt: "2026-10-01T12:05:00Z", DeployLeadMinutes: 15});
        expect(shortBreaks([first, next])).toEqual([{name: "Другий", minutes: 15}]);
        expect(shortBreaks([first, {...next, OpensAt: "2026-10-01T12:30:00Z"}])).toEqual([]);
        expect(shortBreaks([first, {...next, DeployLeadMinutes: 0}])).toEqual([]);
        expect(shortBreaks([first])).toEqual([]);
    });
});
