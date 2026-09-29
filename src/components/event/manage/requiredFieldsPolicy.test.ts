import {describe, expect, it} from "vitest";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import {newRequiredFields, policyQuestion} from "./requiredFieldsPolicy";
import {conditionSources, participantFormProblem, setStaffOnly} from "./participantFormEditor";

function field(key: string, patch: Partial<FormField> = {}): FormField {
    return {id: key, type: "field", key, input: "text", label: key, ...patch};
}

function form(blocks: FormField[], patch: Partial<ParticipantForm> = {}): ParticipantForm {
    return {Version: 1, Enabled: true, Required: true, Document: {blocks}, Answered: 3, ...patch};
}

describe("newRequiredFields", () => {
    it("lists new and just-required questions only", () => {
        const saved = form([field("city", {required: true}), field("school"), field("age", {required: true})]);
        const draft = {Enabled: true, Required: true, Document: {blocks: [field("city", {required: true}), field("school", {required: true}), field("age", {required: true}), field("club", {required: true}), field("note")]}};
        expect(newRequiredFields(saved, draft).map(item => item.key)).toEqual(["school", "club"]);
    });

    it("counts every required question when the form itself just became required", () => {
        const saved = form([field("city", {required: true})], {Required: false});
        const draft = {Enabled: true, Required: true, Document: {blocks: [field("city", {required: true}), field("school", {required: true})]}};
        expect(newRequiredFields(saved, draft).map(item => item.key)).toEqual(["city", "school"]);
    });

    it("never asks for staff-only questions and ignores an optional or disabled form", () => {
        const draft = {Enabled: true, Required: true, Document: {blocks: [field("note", {required: true, staffOnly: true})]}};
        expect(newRequiredFields(form([]), draft)).toEqual([]);
        expect(newRequiredFields(form([]), {...draft, Required: false, Document: {blocks: [field("a", {required: true})]}})).toEqual([]);
        expect(newRequiredFields(form([]), {...draft, Enabled: false, Document: {blocks: [field("a", {required: true})]}})).toEqual([]);
    });
});

describe("policyQuestion", () => {
    const draft = {Enabled: true, Required: true, Document: {blocks: [field("club", {required: true})]}};

    it("asks only when someone already answered", () => {
        expect(policyQuestion(form([]), draft).map(item => item.key)).toEqual(["club"]);
        expect(policyQuestion(form([], {Answered: 0}), draft)).toEqual([]);
        expect(policyQuestion(null, draft)).toEqual([]);
    });
});

describe("staff-only questions in the editor", () => {
    it("staff-only clears required and editable and turns a file into text", () => {
        const blocks = setStaffOnly([field("cv", {input: "file", required: true, editable: true, fileTypes: ["pdf"], maxSizeMB: 5})], 0, true);
        expect(blocks[0]).toMatchObject({staffOnly: true, required: false, input: "text"});
        expect((blocks[0] as FormField).editable).toBeUndefined();
        expect((blocks[0] as FormField).fileTypes).toBeUndefined();
        expect((setStaffOnly(blocks, 0, false)[0] as FormField).staffOnly).toBeUndefined();
    });

    it("a participant question cannot pick a staff-only source, a staff-only one can", () => {
        const blocks = [field("came", {input: "checkbox", staffOnly: true}), field("why"), field("note", {staffOnly: true})];
        expect(conditionSources(blocks, 1).map(item => item.key)).toEqual([]);
        expect(conditionSources(blocks, 2).map(item => item.key)).toEqual(["came", "why"]);
    });

    it("saving is refused when a participant question depends on a staff-only one", () => {
        const condition = {fieldKey: "came", operator: "equals" as const, value: true};
        const blocks = [field("came", {input: "checkbox", staffOnly: true}), field("why", {condition})];
        expect(participantFormProblem({blocks})?.index).toBe(1);
        expect(participantFormProblem({blocks: [blocks[0], field("why", {condition, staffOnly: true})]})).toBeNull();
    });
});
