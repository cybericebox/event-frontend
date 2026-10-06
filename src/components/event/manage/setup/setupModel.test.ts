import {describe, expect, it} from "vitest";
import type {ManageConfig, ManageLifecycle} from "@/api/manage";
import {buildSetupSteps, summarizeSetup, type SetupInput} from "./setupModel";

const config = {Participation: 1, Registration: 2, MaxTeamSize: 4, InfrastructureAllowed: false} as ManageConfig;
const lifecycle = {Configured: true, Status: "published", Infrastructure: {HasDynamicLabs: false, LaboratoriesAvailable: false, RequiresVPN: false, CanStart: true}} as ManageLifecycle;
const mail = {Identity: {Sender: {Name: "", Address: "a@b.c"}, ReplyTo: {Name: "", Address: ""}}, Inherited: {Sender: {Name: "", Address: ""}, ReplyTo: {Name: "", Address: ""}}} as SetupInput["mail"];
const set = (extra: Record<string, unknown> = {}) => ({Status: 0, Scope: "catalog", ...extra}) as never;
const base = (extra: Partial<SetupInput> = {}): SetupInput => ({config, lifecycle, attachments: [set()], content: {Landing: {blocks: [{}]}, LandingDraft: null} as never, mail, ...extra});
const status = (input: SetupInput, id: string) => buildSetupSteps(input).find(step => step.id === id)?.status;

describe("event setup steps", () => {
    it("is complete when every required step is done and the event is published", () => {
        const summary = summarizeSetup(buildSetupSteps(base()));
        expect(summary).toMatchObject({blocked: false, complete: true});
        expect(summary.done).toBe(summary.total);
    });

    it("asks for the participation format and the schedule first", () => {
        const input = base({config: {...config, Participation: null}, lifecycle: {...lifecycle, Configured: false, Status: "not_published"}});
        expect(status(input, "participation")).toBe("todo");
        expect(status(input, "schedule")).toBe("todo");
        expect(status(input, "publish")).toBe("todo");
        expect(summarizeSetup(buildSetupSteps(input)).complete).toBe(false);
    });

    it("asks for a challenge set when none is attached", () => {
        expect(status(base({attachments: []}), "challenges")).toBe("todo");
    });

    it("leaves out the steps whose data has not loaded", () => {
        const ids = buildSetupSteps({config, lifecycle}).map(step => step.id);
        expect(ids).not.toContain("challenges");
        expect(ids).not.toContain("pages");
        expect(ids).not.toContain("mail");
    });

    it("keeps optional steps out of the progress count", () => {
        const steps = buildSetupSteps(base({config: {...config, Registration: 0}}));
        expect(steps.find(step => step.id === "registration")?.status).toBe("optional");
        expect(summarizeSetup(steps).total).toBe(steps.filter(step => step.status !== "optional").length);
    });

    it("shows the stands step only on an event with infrastructure and blocks it when labs cannot start", () => {
        expect(status(base(), "stands")).toBeUndefined();
        const infra = base({config: {...config, InfrastructureAllowed: true}, lifecycle: {...lifecycle, Infrastructure: {...lifecycle.Infrastructure, HasDynamicLabs: true, CanStart: false}}});
        expect(status(infra, "stands")).toBe("blocked");
        expect(summarizeSetup(buildSetupSteps(infra)).blocked).toBe(true);
    });

    it("marks the publication blocked while a blocker stands", () => {
        const infra = base({config: {...config, InfrastructureAllowed: true}, lifecycle: {...lifecycle, Status: "not_published", Infrastructure: {...lifecycle.Infrastructure, HasDynamicLabs: true, CanStart: false}}});
        expect(status(infra, "publish")).toBe("blocked");
    });

    it("takes the sender from the platform when the event has none of its own", () => {
        const inherited = {Identity: {Sender: {Name: "", Address: ""}}, Inherited: {Sender: {Name: "", Address: "x@y.z"}}} as never;
        expect(status(base({mail: inherited}), "mail")).toBe("done");
        expect(status(base({mail: {Identity: {Sender: {Name: "", Address: ""}}, Inherited: {Sender: {Name: "", Address: ""}}} as never}), "mail")).toBe("optional");
    });

    it("asks to review a home page nobody has built yet", () => {
        const untouched = base({content: {Landing: {blocks: []}, LandingDraft: null} as never});
        expect(status(untouched, "pages")).toBe("review");
        expect(summarizeSetup(buildSetupSteps(untouched)).complete).toBe(false);
    });

    it("flags an unpublished landing draft", () => {
        expect(status(base({content: {LandingDraft: {}} as never}), "pages")).toBe("todo");
    });

    it("asks for a resource reservation while lab sets are attached and the platform has not reserved", () => {
        const lab = base({config: {...config, InfrastructureAllowed: true}, attachments: [set({Infrastructure: true})]});
        expect(status({...lab, resources: {Reserved: false} as never}, "resources")).toBe("todo");
        expect(status({...lab, resources: {Reserved: true} as never}, "resources")).toBe("done");
        expect(status(lab, "resources")).toBeUndefined();
        expect(status({...base({config: {...config, InfrastructureAllowed: true}}), resources: {Reserved: false} as never}, "resources")).toBeUndefined();
        expect(summarizeSetup(buildSetupSteps({...lab, resources: {Reserved: false} as never})).complete).toBe(false);
    });

    it("warns, without blocking, about hints participants will not see or that cost nothing", () => {
        const warning = (input: SetupInput) => buildSetupSteps(input).find(step => step.id === "challenges");
        const hint = (Cost: number) => ({Cost});
        expect(warning(base({challenges: [{HintsEnabled: true, Hints: [hint(5)]}]}))?.warning).toBeUndefined();
        expect(warning(base({challenges: [{HintsEnabled: false, Hints: [hint(5)]}, {HintsEnabled: true, Hints: [hint(0), hint(0)]}, {HintsEnabled: false, Hints: []}]}))?.warning).toEqual({detail: "challengesHints", vars: {count: 2}});
        expect(warning(base({config: {...config, HintsDisabled: true}, challenges: [{HintsEnabled: true, Hints: [hint(5)]}]}))?.warning?.vars).toEqual({count: 1});
        expect(warning(base({challenges: [{HintsEnabled: false, Hints: [hint(5)]}]}))?.status).toBe("done");
    });
});
