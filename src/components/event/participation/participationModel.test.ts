import {describe, expect, it} from "vitest";
import type {ParticipantForm} from "@/api/manageParticipantForm";
import {changedEditableAnswers, editableForm, formatAnswer, formFields, rosterLine} from "./participationModel";

const form: ParticipantForm = {Version: 1, Enabled: true, Required: true, Document: {blocks: [
    {id: "a", type: "field", key: "city", input: "text", label: "Місто", editable: true},
    {id: "b", type: "field", key: "school", input: "text", label: "Заклад"},
    {id: "c", type: "field", key: "langs", input: "multi_select", label: "Мови", options: ["Go", "TS"], editable: true},
]}};

describe("participation model", () => {
    it("formats stored answers for reading", () => {
        expect(formatAnswer(undefined)).toBe("—");
        expect(formatAnswer(["Go", "TS"])).toBe("Go, TS");
        expect(formatAnswer(true)).toBe("Так");
        expect(formatAnswer(3)).toBe("3");
    });

    it("keeps only editable fields in the edit form", () => {
        expect(formFields(editableForm(form)).map(field => field.key)).toEqual(["city", "langs"]);
        expect(editableForm(form).Required).toBe(false);
        expect(formFields({...form, Enabled: false})).toEqual([]);
    });

    it("sends only changed editable answers", () => {
        const before = {city: "Київ", school: "КПІ", langs: ["Go"]};
        expect(changedEditableAnswers(form, before, {...before, city: "Львів", school: "ЛНУ"})).toEqual({city: "Львів"});
        expect(changedEditableAnswers(form, before, {...before, langs: ["Go"]})).toEqual({});
        expect(changedEditableAnswers(form, before, {...before, langs: ["Go", "TS"]})).toEqual({langs: ["Go", "TS"]});
    });

    it("describes the roster size", () => {
        expect(rosterLine(3, 5, 2)).toBe("3 з 5 · мінімум 2");
        expect(rosterLine(1, null, 1)).toBe("1");
    });
});
