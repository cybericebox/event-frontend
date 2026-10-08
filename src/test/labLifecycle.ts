import type {LabLifecycle} from "@/api/labLifecycle";

export const labID = "00000000-0000-4000-8000-000000000100";
export const exerciseID = "00000000-0000-4000-8000-000000000200";
export const runningLab: LabLifecycle = {
    ID: labID, EventExerciseID: exerciseID, Revision: "9007199254740993",
    LogicalClosed: false, CloseReason: null, ClosedAt: null,
    RuntimeState: "ready", CanStop: false, CanRestart: false,
};
export const completedLab: LabLifecycle = {
    ...runningLab, Revision: "9007199254740994", LogicalClosed: true,
    CloseReason: "solved", ClosedAt: "2026-10-08T12:00:00Z", RuntimeState: "closed",
};
