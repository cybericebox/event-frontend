import {describe, expect, it} from "vitest";
import type {FormBlock} from "@/api/manageParticipantForm";
import {visibleFieldKeys} from "./formVisibility";

const blocks: FormBlock[] = [
    {id: "1", type: "field", key: "team", input: "checkbox", label: "Є команда?"},
    {id: "2", type: "field", key: "solo", input: "text", label: "Чому сам?", condition: {fieldKey: "team", operator: "equals", value: false}},
    {id: "3", type: "field", key: "size", input: "number", label: "Скільки людей?", condition: {fieldKey: "team", operator: "equals", value: true}},
    {id: "4", type: "field", key: "big", input: "text", label: "Хто капітан?", condition: {fieldKey: "size", operator: "not_equals", value: 1}},
];

describe("conditional questions", () => {
    it("treats an untouched checkbox as «Ні»", () => {
        expect([...visibleFieldKeys(blocks, {})]).toEqual(["team", "solo"]);
    });

    it("shows a question once its source answer matches", () => {
        expect([...visibleFieldKeys(blocks, {team: true})]).toEqual(["team", "size"]);
        expect([...visibleFieldKeys(blocks, {team: true, size: 4})]).toEqual(["team", "size", "big"]);
        expect([...visibleFieldKeys(blocks, {team: true, size: 1})]).toEqual(["team", "size"]);
    });

    it("hides questions that depend on a hidden question", () => {
        expect(visibleFieldKeys(blocks, {team: false, size: 4}).has("big")).toBe(false);
    });

    it("never matches an unanswered question", () => {
        expect(visibleFieldKeys(blocks, {team: true, size: ""}).has("big")).toBe(false);
    });
});

describe("file answers in conditions", () => {
    it("never satisfy a condition", () => {
        const withFile: FormBlock[] = [
            {id: "1", type: "field", key: "cv", input: "file", label: "CV", fileTypes: ["pdf"]},
            {id: "2", type: "field", key: "why", input: "text", label: "Чому?", condition: {fieldKey: "cv", operator: "not_equals", value: "x"}},
        ];
        expect([...visibleFieldKeys(withFile, {cv: {id: "1", name: "cv.pdf", size: 1, contentType: "application/pdf"}})]).toEqual(["cv"]);
    });
});

describe("date conditions", () => {
    const blocks: FormBlock[] = [
        {id: "1", type: "field", key: "born", input: "date", label: "Дата народження", dateMode: "date"},
        {id: "2", type: "field", key: "parent", input: "text", label: "Згода батьків", condition: {fieldKey: "born", operator: "after", value: "2008-09-29"}},
        {id: "3", type: "field", key: "start", input: "date", label: "Початок", dateMode: "datetime"},
        {id: "4", type: "field", key: "late", input: "text", label: "Чому пізно?", condition: {fieldKey: "start", operator: "after", value: "2026-10-01T09:00:00.000Z"}},
    ];
    it("compare dates and datetimes in time", () => {
        expect(visibleFieldKeys(blocks, {born: "2010-01-01"}).has("parent")).toBe(true);
        expect(visibleFieldKeys(blocks, {born: "2008-09-29"}).has("parent")).toBe(false);
        expect(visibleFieldKeys(blocks, {}).has("parent")).toBe(false);
        expect(visibleFieldKeys(blocks, {start: "2026-10-01T09:00:01Z"}).has("late")).toBe(true);
        expect(visibleFieldKeys(blocks, {start: "2026-10-01T08:59:00Z"}).has("late")).toBe(false);
    });
});

describe("time conditions", () => {
    it("compare times of day", () => {
        const blocks: FormBlock[] = [
            {id: "1", type: "field", key: "arrive", input: "date", label: "Прибуття", dateMode: "time"},
            {id: "2", type: "field", key: "late", input: "text", label: "Чому пізно?", condition: {fieldKey: "arrive", operator: "after", value: "09:00"}},
        ];
        expect(visibleFieldKeys(blocks, {arrive: "09:30"}).has("late")).toBe(true);
        expect(visibleFieldKeys(blocks, {arrive: "08:45"}).has("late")).toBe(false);
    });
});
