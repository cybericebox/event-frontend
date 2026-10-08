// Complete frozen-contract fixtures; no live producer proof is implied.
export const compute = (cpu = "500", memory = "1024") => ({CPUMillicores: cpu, MemoryBytes: memory});
export const allocation = {
    ConfiguredRequests: compute(), ConfiguredLimits: compute("1000", "2048"), AllocatedRequests: compute(),
    Used: compute("50", "512"), ReleasedRequests: compute("0", "0"), RuntimeState: "Allocated" as const,
    ObservedAt: "2026-10-08T10:00:00Z", ReleasedAt: null, UsageAvailable: true,
    SnapshotQuotaBytes: "4096", StorageState: "Retained" as const,
    PhysicalStorageBytesAvailable: false, PhysicalStorageBytes: "0",
};
export const managedLab = {
    ID: "01900000-0000-7000-8000-000000000055", EventExerciseID: "01900000-0000-7000-8000-000000000066",
    TeamID: "01900000-0000-7000-8000-000000000022", ExerciseName: "Shared web", Revision: "7", ObservedRevision: "7",
    Generation: 1, AgentUID: "native-agent-uid", DesiredState: "Stopped" as const, ActualState: "StopFailed" as const,
    CloseReason: "solved" as const, ClosedAt: "2026-10-08T09:59:00Z", ActualStoppedAt: null,
    RetentionUntil: null, ObservedAt: "2026-10-08T10:00:00Z", SnapshotPolicy: null, SnapshotState: "Failed" as const,
    FailureCode: "SnapshotFailed", FailureMessage: "capture failed", Resources: allocation,
};
export const observation = {
    ObservedAt: "2026-10-08T10:00:00Z", Complete: true, Held: {...compute(), SnapshotQuotaBytes: "4096"},
    PendingStarts: compute("250"), GroupServices: compute("50"), PhysicalStorageBytesAvailable: false, PhysicalStorageBytes: "0",
};
