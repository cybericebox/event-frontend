import type {LabRuntime} from "@/api/manageLabs";
import type {LabLifecycle} from "@/api/labLifecycle";

export const labID = "00000000-0000-4000-8000-000000000100";
export const exerciseID = "00000000-0000-4000-8000-000000000200";
export const runningLab: LabLifecycle = {
    ID: labID, EventExerciseID: exerciseID, Revision: "9007199254740993",
    LogicalClosed: false, CloseReason: null, ClosedAt: null,
    RuntimeState: "ready", CanStop: false, CanRestart: false, SnapshotPolicy: null, RetentionUntil: null,
};
export const completedLab: LabLifecycle = {
    ...runningLab, Revision: "9007199254740994", LogicalClosed: true,
    CloseReason: "solved", ClosedAt: "2026-10-08T12:00:00Z", RuntimeState: "closed",
};

export const runtimeFixture: LabRuntime = {Lab: runningLab, Phase: "Ready", Ready: true, Queue: null, VPNCIDR: "10.128.1.0/24", InternetCIDR: "", Access: []};

export const manualRunningLab: LabLifecycle = {...runningLab, CanStop: true, SnapshotPolicy: "required"};
export const manuallyStoppedLab: LabLifecycle = {...manualRunningLab, Revision: "9007199254740994", LogicalClosed: true, CloseReason: "manual", ClosedAt: "2026-10-08T12:00:00Z", RuntimeState: "closed", CanStop: false, CanRestart: true};
