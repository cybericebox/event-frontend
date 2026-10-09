import {describe, expect, it} from "vitest";
import {LabLifecycleSchema, compareRevision} from "./labLifecycle";
import {completedLab, runningLab} from "@/test/labLifecycle";

describe("shared Lab lifecycle", () => {
    it("preserves a decimal revision beyond safe JSON integers", () => {
        expect(LabLifecycleSchema.parse(completedLab)).toEqual(completedLab);
        expect(compareRevision(completedLab.Revision, runningLab.Revision)).toBeGreaterThan(0);
    });

    it.each([9007199254740992, "", "01", "-1", "1.5", "1e3", " 1"])("rejects noncanonical revision %s", Revision => {
        expect(LabLifecycleSchema.safeParse({...runningLab, Revision}).success).toBe(false);
    });

    it.each(["stopping", "Snapshotting", "StopFailed", "unknown"])("rejects participant runtime state %s", RuntimeState => {
        expect(LabLifecycleSchema.safeParse({...runningLab, RuntimeState}).success).toBe(false);
    });

    it.each(Object.keys(runningLab).filter(field => !["SnapshotPolicy", "RetentionUntil"].includes(field)))("requires field %s on a present Lab", field => {
        const input: Record<string, unknown> = {...runningLab};
        delete input[field];
        expect(LabLifecycleSchema.safeParse(input).success).toBe(false);
    });

    it.each([
        ["0", "0", 0], ["9", "10", -1], ["10", "9", 1],
        ["9007199254740993", "9007199254740994", -1],
        ["99999999999999999999", "100000000000000000000", -1],
    ] as const)("orders decimal %s against %s", (a, b, expected) => {
        expect(Math.sign(compareRevision(a, b))).toBe(expected);
    });

    it.each([{ID: "question-id"}, {EventExerciseID: "question-id"}, {CloseReason: "failed"}, {LogicalClosed: "true"}, {CanStop: 1}])("rejects malformed present fields %j", fields => {
        expect(LabLifecycleSchema.safeParse({...runningLab, ...fields}).success).toBe(false);
    });

    it("preserves subsequent policy metadata when present without requiring it on the base contract", () => {
        const input = {...runningLab, SnapshotPolicy: "required", RetentionUntil: "2026-10-09T12:00:00Z"};
        expect(LabLifecycleSchema.parse(input)).toEqual(input);
        expect(LabLifecycleSchema.parse({...runningLab, SnapshotPolicy: null, RetentionUntil: null})).toMatchObject({SnapshotPolicy: null, RetentionUntil: null});
    });

    it.each([{SnapshotPolicy: "failed"}, {RetentionUntil: 1000}])("rejects malformed subsequent metadata %j", fields => {
        expect(LabLifecycleSchema.safeParse({...runningLab, ...fields}).success).toBe(false);
    });
});
