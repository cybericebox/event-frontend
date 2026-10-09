import {z} from "zod";

// Exact local copy of the frozen producer contract. New quantities never use JSON numbers.
export const DecimalSchema = z.string().regex(/^(0|[1-9]\d*)$/);
const time = z.string().nullable();
const desired = z.enum(["Running", "Stopped", "Deleted"]);
export const ManagedActualStateSchema = z.enum(["Running", "Snapshotting", "Stopping", "Stopped", "StopFailed", "Starting", "Unknown", "Deleting", "Deleted"]);
export const ComputeViewSchema = z.object({CPUMillicores: DecimalSchema, MemoryBytes: DecimalSchema});
export const AllocationViewSchema = z.object({
    ConfiguredRequests: ComputeViewSchema, ConfiguredLimits: ComputeViewSchema,
    AllocatedRequests: ComputeViewSchema, Used: ComputeViewSchema, ReleasedRequests: ComputeViewSchema,
    RuntimeState: z.enum(["Allocated", "Releasing", "Released", "Unknown"]),
    ObservedAt: time, ReleasedAt: time, UsageAvailable: z.boolean(), SnapshotQuotaBytes: DecimalSchema,
    StorageState: z.enum(["None", "Retained", "DeleteRequested", "CleanupPending", "Deleted", "Unknown"]),
    PhysicalStorageBytesAvailable: z.boolean(), PhysicalStorageBytes: DecimalSchema,
});
export const ManagedLabViewSchema = z.object({
    ID: z.string().uuid(), EventExerciseID: z.string().uuid(), TeamID: z.string().uuid(), ExerciseName: z.string(),
    Revision: DecimalSchema, ObservedRevision: DecimalSchema, Generation: z.number().int().nonnegative(), AgentUID: z.string(),
    DesiredState: desired, ActualState: ManagedActualStateSchema,
    CloseReason: z.enum(["solved", "manual", "stage", "event"]).nullable(),
    ClosedAt: time, ActualStoppedAt: time, RetentionUntil: time, ObservedAt: time,
    SnapshotPolicy: z.enum(["none", "required"]).nullish().transform(value => value ?? null),
    SnapshotState: z.enum(["NotRequired", "Pending", "Succeeded", "Failed", "Unknown"]),
    FailureCode: z.string(), FailureMessage: z.string(), Resources: AllocationViewSchema,
});
export const ManagedGroupViewSchema = z.object({
    Name: z.string(), Revision: DecimalSchema, ObservedRevision: DecimalSchema, AgentUID: z.string(),
    DesiredState: desired, ActualState: ManagedActualStateSchema, Ready: z.boolean(), ObservedAt: time,
    FailureCode: z.string(), FailureMessage: z.string(), Resources: AllocationViewSchema,
});
export const ResourceObservationSchema = z.object({
    ObservedAt: time, Complete: z.boolean(), Held: ComputeViewSchema.extend({SnapshotQuotaBytes: DecimalSchema}),
    PendingStarts: ComputeViewSchema, GroupServices: ComputeViewSchema,
    PhysicalStorageBytesAvailable: z.boolean(), PhysicalStorageBytes: DecimalSchema,
});
export type ComputeView = z.infer<typeof ComputeViewSchema>;
export type AllocationView = z.infer<typeof AllocationViewSchema>;
export type ManagedLabView = z.infer<typeof ManagedLabViewSchema>;
export type ManagedGroupView = z.infer<typeof ManagedGroupViewSchema>;
export type ResourceObservation = z.infer<typeof ResourceObservationSchema>;
