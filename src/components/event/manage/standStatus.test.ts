import type {ManagedLabView} from "@/api/labObservations";
import {managedLab} from "@/test/labObservations";
import {describe, expect, it} from "vitest";
import {canRecreate, hasCurrentLabAllocation, orderStands, standStatusLabel, standStatusTone, standTeamName} from "./standStatus";

const stand = (teamID: string, moderators: boolean) => ({TeamID: teamID, TeamName: `T-${teamID}`, Moderators: moderators, Status: "ready" as const, Reason: "", UpdatedAt: null, Generation: 0, Labs: [], Queue: null, ImageWarning: false});

describe("stand status", () => {
    it("labels every status in Ukrainian", () => {
        expect(Object.values(standStatusLabel)).toEqual(["Не розгорнуто", "Створюється", "Готово", "Помилка", "Видалено"]);
        expect(standStatusTone.failed).toBe("danger");
    });

    it("allows recreate only for an existing stand", () => {
        expect(canRecreate("failed")).toBe(true);
        expect(canRecreate("ready")).toBe(true);
        expect(canRecreate("not_deployed")).toBe(false);
        expect(canRecreate("removed")).toBe(false);
    });

    it("puts the moderators team first under its own label", () => {
        const ordered = orderStands([stand("a", false), stand("m", true)]);
        expect(ordered.map(item => item.TeamID)).toEqual(["m", "a"]);
        expect(standTeamName(ordered[0])).toBe("Команда модераторів");
    });
});

const certified: ManagedLabView = {
    ...managedLab, Revision: "8", ObservedRevision: "8", ActualState: "Stopped", SnapshotState: "Succeeded",
    ActualStoppedAt: "2026-10-08T10:01:00Z", ObservedAt: "2026-10-08T10:02:00Z",
    Resources: {...managedLab.Resources, RuntimeState: "Released", ReleasedAt: "2026-10-08T10:01:00Z", ObservedAt: "2026-10-08T10:02:00Z", AllocatedRequests: {CPUMillicores: "0", MemoryBytes: "0"}, ReleasedRequests: {CPUMillicores: "500", MemoryBytes: "1024"}},
};
describe("certified release uses identity and producer state, not independent clock order", () => {
    it.each([
        ["physical release before aggregate stopped", "2026-10-08T10:02:00Z", "2026-10-08T10:02:00Z", "2026-10-08T10:02:00Z"],
        ["independently later aggregate observation", "2026-10-08T10:01:00Z", "2026-10-08T10:03:00Z", "2026-10-08T10:02:00Z"],
        ["later aggregate stopped declaration", "2026-10-08T10:03:00Z", "2026-10-08T10:02:00Z", "2026-10-08T10:02:00Z"],
        ["previous assumed-order control", "2026-10-08T10:01:00Z", "2026-10-08T10:02:00Z", "2026-10-08T10:02:00Z"],
    ])("accepts %s", (_name, ActualStoppedAt, ObservedAt, allocationObservedAt) => {
        expect(hasCurrentLabAllocation({...certified, ActualStoppedAt, ObservedAt, Resources: {...certified.Resources, ObservedAt: allocationObservedAt}})).toBe(true);
    });
    it.each([
        {AgentUID: ""}, {ObservedRevision: "7"}, {ObservedAt: null}, {ObservedAt: "invalid"},
        {ActualState: "StopFailed"}, {SnapshotState: "Failed"}, {ActualStoppedAt: null},
    ] satisfies Partial<ManagedLabView>[])('keeps identity/missing observation/failed-stop safeguards: %j', patch => {
        expect(hasCurrentLabAllocation({...certified, ...patch})).toBe(false);
    });
    it.each([{ObservedAt: null}, {ObservedAt: "invalid"}, {ReleasedAt: null}, {ReleasedAt: "invalid"}])("rejects missing/malformed allocation certification time: %j", patch => {
        expect(hasCurrentLabAllocation({...certified, Resources: {...certified.Resources, ...patch}})).toBe(false);
    });
});
