import {z} from "zod";

// Lifecycle revisions travel as canonical decimals, never lossy JSON numbers.
export const revisionSchema = z.string().regex(/^(0|[1-9]\d*)$/);
export const LabLifecycleSchema = z.object({
    ID: z.string().uuid(), EventExerciseID: z.string().uuid(), Revision: revisionSchema,
    LogicalClosed: z.boolean(), CloseReason: z.enum(["solved", "manual", "stage", "event"]).nullable(),
    ClosedAt: z.string().nullable(), RuntimeState: z.enum(["preparing", "ready", "closed", "unavailable"]),
    CanStop: z.boolean(), CanRestart: z.boolean(),
    // Subsequent producer metadata is additive; the base lifecycle needs neither.
    SnapshotPolicy: z.enum(["none", "required"]).nullish().transform(value => value ?? null),
    RetentionUntil: z.string().nullish().transform(value => value ?? null),
});
export type LabLifecycle = z.infer<typeof LabLifecycleSchema>;

// Inputs have been validated by revisionSchema; length then lexicographic order
// compares arbitrary precision without converting them to Number.
export function compareRevision(a: string, b: string): number {
    return a.length === b.length ? (a === b ? 0 : a < b ? -1 : 1) : a.length - b.length;
}
