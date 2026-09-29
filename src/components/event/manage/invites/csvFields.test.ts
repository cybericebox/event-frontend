import {describe, expect, it} from "vitest";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import {buildSchema, exampleRow, missingRequired, parseFieldCell, templateHeader} from "./csvFields";
import {csvTemplate, inviteColumns, parseInviteCsv, parseTeamCsv, teamColumns} from "./inviteCsv";

function field(key: string, input: FormField["input"], extra: Partial<FormField> = {}): FormField {
    return {id: key, type: "field", key, input, label: key.toUpperCase(), ...extra};
}
function form(fields: FormField[], required = true): ParticipantForm {
    return {Version: 1, Enabled: true, Required: required, Document: {blocks: fields}};
}

const people = form([
    field("city", "text", {required: true}),
    field("bio", "long_text"),
    field("age", "number"),
    field("level", "select", {options: ["Junior", "Senior"], required: true}),
    field("langs", "multi_select", {options: ["Go", "TS", "Rust"]}),
    field("student", "checkbox"),
    field("born", "date", {dateMode: "date", minDate: "1990-01-01"}),
    field("slot", "date", {dateMode: "time"}),
    field("start", "date", {dateMode: "datetime"}),
    field("cv", "file", {required: true}),
]);
const teamForm = form([field("school", "text", {required: true}), field("email", "text")]);

describe("csv form columns", () => {
    it("builds columns from the current forms, skipping files and renaming clashes", () => {
        const schema = buildSchema(people, teamForm, teamColumns);
        expect(schema.participant.map(column => column.code)).toEqual(["city", "bio", "age", "level", "langs", "student", "born", "slot", "start"]);
        expect(schema.team.map(column => column.code)).toEqual(["school", "team_email"]);
        expect(schema.skipped.map(item => item.field.key)).toEqual(["cv"]);
        expect(templateHeader(schema, "team")).toEqual(["team", "school*", "team_email", "email", "first_name", "last_name", "captain",
            "city*", "bio", "age", "level*", "langs", "student", "born", "slot", "start"]);
        expect(templateHeader(schema, "invite").slice(0, 4)).toEqual(["email", "first_name", "last_name", "city*"]);
    });

    it("marks nothing required when the whole form is optional", () => {
        expect(buildSchema(form([field("city", "text", {required: true})], false), null, inviteColumns).participant[0].required).toBe(false);
    });

    it("has no team columns without team fields", () => {
        expect(buildSchema(people, null, inviteColumns).team).toEqual([]);
    });

    it("parses the example row of the template cleanly for every field type", () => {
        const schema = buildSchema(people, teamForm, teamColumns);
        const csv = csvTemplate(templateHeader(schema, "team"), [
            ["T", ...exampleRow(schema.team, true), "cap@school.test", "A", "B", "так", ...exampleRow(schema.participant, true)],
            ["T", ...exampleRow(schema.team, false), "m@school.test", "C", "D", "", ...exampleRow(schema.participant, true)],
        ]);
        const {teams, issues} = parseTeamCsv(csv, schema);
        expect(issues).toEqual([]);
        expect(teams[0].fields).toEqual({school: "Текст", email: "Текст"});
        expect(teams[0].members[0].fields).toEqual({
            city: "Текст", bio: "Довгий текст", age: 42, level: "Junior", langs: ["Go", "TS"], student: true,
            born: "2026-10-15", slot: "14:30", start: "2026-10-15T14:30:00Z",
        });
    });

    it("reports a bad value with its row and column", () => {
        const schema = buildSchema(people, null, inviteColumns);
        const csv = "email,city*,age,level*,langs,student,born,slot,start\nok@school.test,Kyiv,x,Middle,Go|Java,maybe,1980-01-01,25:00,2026-10-15\n";
        expect(parseInviteCsv(csv, schema).issues).toEqual([
            {row: 2, code: "invalidNumber", column: "age", value: "x"},
            {row: 2, code: "invalidOption", column: "level", value: "Middle"},
            {row: 2, code: "invalidChoice", column: "langs", value: "Go|Java"},
            {row: 2, code: "invalidBool", column: "student", value: "maybe"},
            {row: 2, code: "dateRange", column: "born", value: "1980-01-01"},
            {row: 2, code: "invalidDate", column: "slot", value: "25:00"},
            {row: 2, code: "invalidDate", column: "start", value: "2026-10-15"},
        ]);
    });

    it("accepts Excel-style values", () => {
        const [born, start, age, level, student] = [
            parseFieldCell({code: "born", scope: "participant", field: people.Document.blocks[6] as FormField, required: false}, "05.03.1999"),
            parseFieldCell({code: "start", scope: "participant", field: people.Document.blocks[8] as FormField, required: false}, "2026-10-15 9:05"),
            parseFieldCell({code: "age", scope: "participant", field: people.Document.blocks[2] as FormField, required: false}, "3,5"),
            parseFieldCell({code: "level", scope: "participant", field: people.Document.blocks[3] as FormField, required: false}, "senior"),
            parseFieldCell({code: "student", scope: "participant", field: people.Document.blocks[5] as FormField, required: false}, "Ні"),
        ];
        expect([born.value, start.value, age.value, level.value, student.value]).toEqual(["1999-03-05", "2026-10-15T09:05:00Z", 3.5, "Senior", false]);
    });

    it("merges a team's fields across rows and flags conflicts", () => {
        const schema = buildSchema(null, teamForm, teamColumns);
        const csv = "team,school*,email,captain\nBlue,KPI,a@school.test,так\nBlue,,b@school.test,\nBlue,LNU,c@school.test,\nRed,,d@school.test,так\n";
        const {teams, issues} = parseTeamCsv(csv, schema);
        expect(issues).toEqual([{row: 4, code: "teamFieldConflict", column: "school", value: "LNU"}]);
        expect(teams.map(team => [team.name, team.fields, team.missing])).toEqual([["Blue", {school: "KPI"}, []], ["Red", {}, ["SCHOOL"]]]);
    });

    it("lists the required questions still blank, honouring conditions", () => {
        const conditional = form([
            field("student", "checkbox"),
            field("university", "text", {required: true, condition: {fieldKey: "student", operator: "equals", value: true}}),
            field("city", "text", {required: true}),
            field("cv", "file", {required: true}),
            field("note", "text", {required: true, ...{staffOnly: true}}),
        ]);
        expect(missingRequired(conditional, {student: false})).toEqual(["CITY", "CV"]);
        expect(missingRequired(conditional, {student: true, city: "Kyiv"})).toEqual(["UNIVERSITY", "CV"]);
        expect(missingRequired(form([field("city", "text", {required: true})], false), {})).toEqual([]);
    });

    it("keeps the invite entry with its prefilled answers and gaps", () => {
        const schema = buildSchema(people, null, inviteColumns);
        const {entries, issues} = parseInviteCsv("email,city*,level*\na@school.test,Kyiv,\n", schema);
        expect(issues).toEqual([]);
        expect(entries[0].fields).toEqual({city: "Kyiv"});
        expect(entries[0].missing).toEqual(["LEVEL", "CV"]);
    });
});
