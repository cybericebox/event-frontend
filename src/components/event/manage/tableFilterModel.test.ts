import {describe, expect, it} from "vitest";
import {fieldFilterSpecs, filterChips, nextSort, toTableFilters, withoutFilter, type FilterSpec} from "./tableFilterModel";

const field = (key: string, input: string, options?: string[]) => ({id: key, type: "field" as const, key, label: key, input: input as "text", options});

const specs: FilterSpec[] = [
    {key: "@name", label: "Ім’я", kind: "contains"},
    {key: "@status", label: "Статус", kind: "any", options: [{value: "1", label: "Очікує"}, {value: "3", label: "Відхилено"}]},
    {key: "@members", label: "Учасники", kind: "number"},
    {key: "@date", label: "Дата", kind: "date"},
    {key: "@pending", label: "Очікують", kind: "bool"},
    ...fieldFilterSpecs([field("cv", "file"), field("age", "number"), field("langs", "multi_select", ["Go"])]),
];

describe("date modes", () => {
    const dated = fieldFilterSpecs([
        {...field("day", "date"), dateMode: "date" as const},
        {...field("slot", "date"), dateMode: "time" as const},
        {...field("at", "date"), dateMode: "datetime" as const},
    ]);

    it("keeps the mode of «Дата / час» questions and sends matching bounds", () => {
        expect(dated.map(spec => spec.mode)).toEqual(["date", "time", "datetime"]);
        expect(toTableFilters(dated, {day: {from: "2026-09-01"}, slot: {from: "09:00", to: "9:5"}, at: {to: "2026-09-29T12:00"}})).toEqual([
            {Key: "day", Op: "range", Type: "date", From: "2026-09-01"},
            {Key: "slot", Op: "range", Type: "time", From: "09:00"},
            {Key: "at", Op: "range", Type: "date", To: new Date("2026-09-29T12:00").toISOString().replace(/\.\d{3}Z$/, "Z")},
        ]);
        expect(filterChips(dated, {slot: {from: "09:00", to: "18:00"}}).map(chip => chip.text)).toEqual(["slot: 09:00 – 18:00"]);
    });
});

describe("typed operators", () => {
    const typed: FilterSpec[] = [{key: "@members", label: "Учасники", kind: "number"}, {key: "@email", label: "Пошта", kind: "contains"}];

    it("maps number and text operators", () => {
        expect(toTableFilters(typed, {"@members": {op: "gt", from: "3"}, "@email": {op: "empty"}})).toEqual([
            {Key: "@members", Op: "range", Type: "number", From: 3, FromExclusive: true},
            {Key: "@email", Op: "present", Value: false},
        ]);
        expect(toTableFilters(typed, {"@members": {from: "2"}, "@email": {op: "notEmpty"}})).toEqual([
            {Key: "@members", Op: "range", Type: "number", From: 2, To: 2},
            {Key: "@email", Op: "present", Value: true},
        ]);
        expect(toTableFilters(typed, {"@members": {op: "lt", from: "5"}})).toEqual([{Key: "@members", Op: "range", Type: "number", To: 5, ToExclusive: true}]);
        expect(toTableFilters(typed, {"@members": {op: "between", to: "5"}})).toEqual([{Key: "@members", Op: "range", Type: "number", To: 5}]);
        expect(toTableFilters(typed, {"@members": {op: "gt"}})).toEqual([]);
    });

    it("describes typed operators in chips", () => {
        expect(filterChips(typed, {"@members": {op: "gt", from: "3"}, "@email": {op: "empty"}}).map(chip => chip.text)).toEqual(["Учасники: > 3", "Пошта: порожнє"]);
        expect(filterChips(typed, {"@members": {from: "2"}}).map(chip => chip.text)).toEqual(["Учасники: = 2"]);
    });
});

describe("table filter specs", () => {
    it("maps form inputs to filter kinds", () => {
        expect(fieldFilterSpecs([field("a", "text"), field("b", "long_text"), field("c", "select", ["x"]), field("d", "checkbox"), field("e", "file"), field("f", "number"), field("g", "date")]).map(spec => spec.kind))
            .toEqual(["contains", "contains", "any", "bool", "present", "number", "date"]);
    });

    it("builds filters for every column type and drops empty drafts", () => {
        expect(toTableFilters(specs, {
            "@name": {text: "  Олена "}, "@status": {values: ["3"]}, "@members": {op: "between", from: "2", to: ""},
            "@date": {from: "", to: "2026-09-29T12:00"}, "@pending": {flag: null}, cv: {flag: true}, age: {from: "x"}, langs: {values: []},
        })).toEqual([
            {Key: "@name", Op: "contains", Value: "Олена"},
            {Key: "@status", Op: "any", Values: ["3"]},
            {Key: "@members", Op: "range", Type: "number", From: 2},
            {Key: "@date", Op: "range", Type: "date", To: new Date("2026-09-29T12:00").toISOString().replace(/\.\d{3}Z$/, "Z")},
            {Key: "cv", Op: "present", Value: true},
        ]);
    });

    it("describes active filters as chips and removes one", () => {
        const drafts = {"@name": {text: "ol"}, "@status": {values: ["1", "3"]}, "@members": {op: "between", from: "2", to: "5"}, "@pending": {flag: false}, cv: {flag: false}};
        expect(filterChips(specs, drafts).map(chip => chip.text)).toEqual([
            "Ім’я: містить «ol»", "Статус: Очікує, Відхилено", "Учасники: 2 – 5", "Очікують: Ні", "cv: Немає файлу",
        ]);
        expect(Object.keys(withoutFilter(drafts, "@status"))).toEqual(["@name", "@members", "@pending", "cv"]);
    });

    it("sorts a new column ascending and flips the active one", () => {
        expect(nextSort({key: "@date", desc: true}, "@name")).toEqual({key: "@name", desc: false});
        expect(nextSort({key: "@name", desc: false}, "@name")).toEqual({key: "@name", desc: true});
    });
});
