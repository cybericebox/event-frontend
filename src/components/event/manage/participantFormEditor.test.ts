import {describe, expect, it} from "vitest";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {addOption, changeInput, conditionOperators, conditionSources, createFormField, parseDateAnswer, duplicateBlock, participantFormProblem, reorderBlocks, defaultCondition, invalidOptions, moveOption, removeBlock, removeOption, renameOption, validateParticipantForm} from "./participantFormEditor";
import {emptyRichText} from "../content/richTextState";

describe("formatted text in forms and surveys", () => {
    it("requires content in a Lexical text block", () => {
        expect(validateParticipantForm({blocks: [{id: "text", type: "text", richText: emptyRichText()}]})).toBe("Блок 1: додайте текст.");
    });
    it("accepts saved Lexical text", () => {
        expect(validateParticipantForm({blocks: [{id: "text", type: "text", richText: {root: {type: "root", version: 1, children: [{type: "paragraph", version: 1, children: [{type: "text", version: 1, text: "Правила"}]}]}}}]})).toBeNull();
    });
});

const field = (key: string, input: FormField["input"], extra: Partial<FormField> = {}): FormField => ({id: key, type: "field", key, input, label: key, ...extra});

describe("display conditions", () => {
    it("offers only earlier single-answer questions as sources", () => {
        const blocks = [field("a", "multi_select", {options: ["x"]}), field("b", "select", {options: ["x", "y"]}), field("c", "text")];
        expect(conditionSources(blocks, 0)).toEqual([]);
        expect(conditionSources(blocks, 1)).toEqual([]);
        expect(conditionSources(blocks, 2).map(item => item.key)).toEqual(["b"]);
        expect(defaultCondition(blocks, 2)).toEqual({fieldKey: "b", operator: "equals", value: "x"});
        expect(defaultCondition(blocks, 1)).toBeUndefined();
    });

    it("accepts a condition only on a previous question with a value of its type", () => {
        const source = field("a", "number");
        expect(validateParticipantForm({blocks: [source, field("b", "text", {condition: {fieldKey: "a", operator: "equals", value: 3}})]})).toBeNull();
        expect(validateParticipantForm({blocks: [source, field("b", "text", {condition: {fieldKey: "a", operator: "equals", value: ""}})]})).toBe("Питання 2: вкажіть число в умові.");
        expect(validateParticipantForm({blocks: [field("b", "text", {condition: {fieldKey: "a", operator: "equals", value: 3}}), source]})).toBe("Питання 1: умова має посилатися на попереднє питання.");
        expect(validateParticipantForm({blocks: [field("a", "text"), field("b", "text", {condition: {fieldKey: "a", operator: "equals", value: " "}})]})).toBe("Питання 2: вкажіть значення умови.");
        expect(validateParticipantForm({blocks: [field("a", "checkbox"), field("b", "text", {condition: {fieldKey: "a", operator: "not_equals", value: false}})]})).toBeNull();
    });

    it("drops conditions on a removed question and resets them when its type changes", () => {
        const blocks: FormBlock[] = [field("a", "checkbox"), field("b", "text", {condition: {fieldKey: "a", operator: "equals", value: true}})];
        expect((removeBlock(blocks, 0)[0] as FormField).condition).toBeUndefined();
        expect((changeInput(blocks, 0, "number")[1] as FormField).condition).toEqual({fieldKey: "a", operator: "equals", value: 0});
        expect((changeInput(blocks, 0, "multi_select")[1] as FormField).condition).toBeUndefined();
        expect((changeInput(blocks, 0, "select")[0] as FormField).options).toEqual([""]);
    });
});

describe("answer options", () => {
    const blocks: FormBlock[] = [field("role", "select", {options: ["Студент", "Інше"]}), field("other", "text", {condition: {fieldKey: "role", operator: "equals", value: "Інше"}})];
    const options = (next: FormBlock[]) => (next[0] as FormField).options;
    const condition = (next: FormBlock[]) => (next[1] as FormField).condition;

    it("adds, removes and reorders rows", () => {
        expect(options(addOption(blocks, 0))).toEqual(["Студент", "Інше", ""]);
        expect(options(moveOption(blocks, 0, 1, -1))).toEqual(["Інше", "Студент"]);
        expect(moveOption(blocks, 0, 0, -1)).toBe(blocks);
        expect(options(removeOption(blocks, 0, 0))).toEqual(["Інше"]);
    });

    it("keeps dependent conditions pointing at a renamed or removed option", () => {
        expect(condition(renameOption(blocks, 0, 1, "Інше місце"))?.value).toBe("Інше місце");
        expect(condition(renameOption(blocks, 0, 0, "Викладач"))?.value).toBe("Інше");
        expect(condition(removeOption(blocks, 0, 1))?.value).toBe("Студент");
    });

    it("rejects empty and repeated options", () => {
        expect(invalidOptions(["А", " ", "Б", "А "])).toEqual(new Set([1, 3]));
        expect(validateParticipantForm({blocks: [field("a", "select", {options: []})]})).toBe("Питання 1: додайте хоча б один варіант відповіді.");
        expect(validateParticipantForm({blocks: [field("a", "select", {options: ["А", ""]})]})).toBe("Питання 1: заповніть варіант 2.");
        expect(validateParticipantForm({blocks: [field("a", "multi_select", {options: ["А", "А"]})]})).toBe("Питання 1: варіанти відповіді повторюються.");
        expect(validateParticipantForm({blocks: [field("a", "multi_select", {options: ["А", "Б"]})]})).toBeNull();
    });
});

describe("file questions", () => {
    it("start with PDF up to 10 MB and never drive a condition", () => {
        const file = createFormField("file");
        expect([file.fileTypes, file.maxSizeMB, file.options]).toEqual([["pdf"], 10, undefined]);
        expect(conditionSources([file, field("b", "text")], 1)).toEqual([]);
    });

    it("switching to a file question drops conditions on it and keeps only its settings", () => {
        const blocks: FormBlock[] = [field("a", "select", {options: ["x"]}), field("b", "text", {condition: {fieldKey: "a", operator: "equals", value: "x"}})];
        const next = changeInput(blocks, 0, "file");
        expect(next[0]).toMatchObject({input: "file", fileTypes: ["pdf"], maxSizeMB: 10, options: undefined});
        expect((next[1] as FormField).condition).toBeUndefined();
        expect(changeInput(next, 0, "text")[0]).toMatchObject({fileTypes: undefined, maxSizeMB: undefined});
    });

    it("need a format and a size within the platform limit", () => {
        expect(validateParticipantForm({blocks: [field("a", "file", {fileTypes: ["pdf", "archive"], maxSizeMB: 25})]})).toBeNull();
        expect(validateParticipantForm({blocks: [field("a", "file", {fileTypes: []})]})).toBe("Питання 1: оберіть хоча б один формат файлу.");
        expect(validateParticipantForm({blocks: [field("a", "file", {fileTypes: ["pdf"], maxSizeMB: 26})]})).toBe("Питання 1: розмір файлу має бути від 1 до 25 МБ.");
        expect(validateParticipantForm({blocks: [field("a", "file", {fileTypes: ["pdf"]}), field("b", "text", {condition: {fieldKey: "a", operator: "equals", value: "x"}})]})).toBe("Питання 2: для умови оберіть питання з однією відповіддю.");
    });
});

describe("card operations", () => {
    const blocks: FormBlock[] = [field("a", "text"), field("b", "select", {options: ["x"]}), field("c", "text", {condition: {fieldKey: "b", operator: "equals", value: "x"}})];

    it("reorder a card onto another card's place", () => {
        expect(reorderBlocks(blocks, "c", "a").map(block => block.id)).toEqual(["c", "a", "b"]);
        expect(reorderBlocks(blocks, "a", "b").map(block => block.id)).toEqual(["b", "a", "c"]);
        expect(reorderBlocks(blocks, "a", "missing")).toBe(blocks);
    });

    it("duplicate a question with its own id and key right below it", () => {
        const result = duplicateBlock(blocks, 1)!;
        const copy = result.copy as FormField;
        expect(result.blocks.map(block => block.id)).toEqual(["a", "b", copy.id, "c"]);
        expect(copy.id).not.toBe("b");
        expect(copy.key).not.toBe("b");
        expect(copy.options).toEqual(["x"]);
        expect((result.blocks[3] as FormField).condition?.fieldKey).toBe("b");
    });

    it("report the block a problem is about", () => {
        expect(participantFormProblem({blocks: [field("a", "text"), field("b", "text", {label: " "})]})).toEqual({index: 1, message: "Питання 2: додайте текст питання."});
        expect(participantFormProblem({blocks})).toBeNull();
    });
});

describe("date questions", () => {
    it("start as a day and reset their settings with the type", () => {
        const date = createFormField("date");
        expect(date.dateMode).toBe("date");
        const next = changeInput([date], 0, "text")[0] as FormField;
        expect([next.dateMode, next.minDate, next.maxDate]).toEqual([undefined, undefined, undefined]);
    });

    it("read answers of their kind only", () => {
        expect(parseDateAnswer("date", "2026-02-28")).toBe(Date.UTC(2026, 1, 28));
        expect(parseDateAnswer("date", "2026-02-30")).toBeNull();
        expect(parseDateAnswer("date", "2026-02-28T00:00:00Z")).toBeNull();
        expect(parseDateAnswer("datetime", "2026-09-29T12:30:00.000Z")).toBe(Date.UTC(2026, 8, 29, 12, 30));
        expect(parseDateAnswer("datetime", "2026-09-29T12:30:00+03:00")).toBeNull();
    });

    it("drive conditions with before and after; other questions only compare", () => {
        const born = field("born", "date", {dateMode: "date"});
        expect(conditionOperators(born)).toEqual(["equals", "not_equals", "before", "after"]);
        expect(conditionOperators(field("a", "text"))).toEqual(["equals", "not_equals"]);
        expect(validateParticipantForm({blocks: [born, field("b", "text", {condition: {fieldKey: "born", operator: "before", value: "2008-01-01"}})]})).toBeNull();
        expect(validateParticipantForm({blocks: [born, field("b", "text", {condition: {fieldKey: "born", operator: "before", value: ""}})]})).toBe("Питання 2: оберіть дату в умові.");
        expect(validateParticipantForm({blocks: [field("a", "text"), field("b", "text", {condition: {fieldKey: "a", operator: "after", value: "x"}})]})).toBe("Питання 2: таке порівняння недоступне для цього питання.");
        const blocks: FormBlock[] = [born, field("b", "text", {condition: {fieldKey: "born", operator: "after", value: "2008-01-01"}})];
        expect((changeInput(blocks, 0, "text")[1] as FormField).condition).toEqual({fieldKey: "born", operator: "equals", value: ""});
    });

    it("check the limits", () => {
        expect(validateParticipantForm({blocks: [field("a", "date", {minDate: "2000-01-01", maxDate: "2010-01-01"})]})).toBeNull();
        expect(validateParticipantForm({blocks: [field("a", "date", {minDate: "2010-01-01", maxDate: "2000-01-01"})]})).toBe("Питання 1: найраніша дата пізніша за найпізнішу.");
        expect(validateParticipantForm({blocks: [field("a", "date", {dateMode: "datetime", minDate: "2010-01-01"})]})).toBe("Питання 1: некоректна межа дати.");
    });
});
