import {describe, expect, it} from "vitest";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {addOption, changeInput, conditionSources, defaultCondition, invalidOptions, moveOption, removeBlock, removeOption, renameOption, validateParticipantForm} from "./participantFormEditor";
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
