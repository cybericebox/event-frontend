import {describe, expect, it} from "vitest";
import type {ParticipantForm} from "@/api/manageParticipantForm";
import {collectFormAnswers} from "./ParticipantFormFields";

const form: ParticipantForm = {Version: 1, Enabled: true, Required: false, Document: {blocks: [
    {id: "a", type: "field", key: "role", input: "select", label: "Роль", options: ["Студент", "Інше"], required: true},
    {id: "b", type: "field", key: "other", input: "text", label: "Уточніть", condition: {fieldKey: "role", operator: "equals", value: "Інше"}},
]}};

describe("registration form answers", () => {
    it("skips an optional form left empty", () => {
        expect(collectFormAnswers(form, {})).toEqual({send: false, answers: {}});
        expect(collectFormAnswers(null, {role: "Інше"})).toEqual({send: false, answers: {}});
    });

    it("drops hidden conditional answers and reports missing required ones", () => {
        expect(collectFormAnswers(form, {role: "Студент", other: "x"})).toEqual({send: true, answers: {role: "Студент"}});
        expect(collectFormAnswers(form, {role: "Інше", other: "Викладач"}).answers).toEqual({role: "Інше", other: "Викладач"});
        expect(collectFormAnswers({...form, Required: true}, {}).error).toBe("Заповніть обовʼязкове питання «Роль».");
    });
});
