import {describe, expect, it} from "vitest";
import {ManagedLabViewSchema, ManagedGroupViewSchema, ResourceObservationSchema} from "./labObservations";
import {StandDetailSchema} from "./manageLabs";
import {ManageResourcesSchema} from "./manageResources";
import {managedLab, observation} from "@/test/labObservations";

describe("frozen operator observations", () => {
    it("preserves canonical Lab and Questions, Group, and exact decimal allocations", () => {
        const detail = StandDetailSchema.parse({TeamID: managedLab.TeamID, Status: "ready", Labs: [{ChallengeID: managedLab.EventExerciseID, Status: "ready", Lab: managedLab, Questions: [{EventChallengeID: managedLab.ID, Name: "First"}, {EventChallengeID: managedLab.EventExerciseID, Name: "Second"}]}], Group: {Name: "team", Revision: "7", ObservedRevision: "7", AgentUID: "agent", DesiredState: "Stopped", ActualState: "Stopped", Ready: false, ObservedAt: managedLab.ObservedAt, FailureCode: "", FailureMessage: "", Resources: managedLab.Resources}});
        expect(detail.Labs[0].Lab?.Resources.AllocatedRequests.CPUMillicores).toBe("500");
        expect(detail.Labs[0].Questions?.map(q => q.Name)).toEqual(["First", "Second"]);
        expect(detail.Group?.Name).toBe("team");
        expect(ManageResourcesSchema.parse({Observation: observation}).Observation?.Held.CPUMillicores).toBe("500");
    });
    it("leaves absent additive fields unknown for legacy responses", () => {
        const detail = StandDetailSchema.parse({TeamID: managedLab.TeamID, Status: "ready", Labs: [{ChallengeID: managedLab.ID, Status: "ready"}]});
        expect(detail.Labs[0].Lab).toBeNull(); expect(detail.Labs[0].Questions).toBeNull(); expect(detail.Group).toBeNull();
        expect(ManageResourcesSchema.parse({}).Observation).toBeNull();
    });
    it.each([7, "-1", "01", "1.5", "1e3", ""])('rejects noncanonical decimal %s', Revision => {
        expect(ManagedLabViewSchema.safeParse({...managedLab, Revision}).success).toBe(false);
        expect(ResourceObservationSchema.safeParse({...observation, Held: {...observation.Held, MemoryBytes: Revision}}).success).toBe(false);
    });
    it("rejects malformed present objects and undeclared enum states", () => {
        expect(ManagedLabViewSchema.safeParse({...managedLab, ActualState: "Ready"}).success).toBe(false);
        expect(ManagedGroupViewSchema.safeParse({Name: "legacy"}).success).toBe(false);
        expect(ResourceObservationSchema.safeParse({}).success).toBe(false);
    });
});
