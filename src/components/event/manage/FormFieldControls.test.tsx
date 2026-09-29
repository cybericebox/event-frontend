// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {useState} from "react";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {FormConditionEditor, FormOptionsEditor} from "./FormFieldControls";

afterEach(cleanup);

let latest: FormBlock[] = [];

function Harness({initial, index, editor}: {initial: FormBlock[]; index: number; editor: "options" | "condition"}) {
    const [blocks, setBlocks] = useState(initial);
    const Editor = editor === "options" ? FormOptionsEditor : FormConditionEditor;
    return <Editor blocks={blocks} index={index} disabled={false} onChange={next => {latest = next; setBlocks(next);}} />;
}

const field = (key: string, input: FormField["input"], extra: Partial<FormField> = {}): FormField => ({id: key, type: "field", key, input, label: key, ...extra});

describe("answer options editor", () => {
    it("edits each option in its own row", () => {
        render(<Harness initial={[field("role", "select", {options: ["Студент"]})]} index={0} editor="options" />);
        fireEvent.click(screen.getByRole("button", {name: "Додати варіант"}));
        fireEvent.change(screen.getByRole("textbox", {name: "Варіант 2"}), {target: {value: "Інше"}});
        expect((latest[0] as FormField).options).toEqual(["Студент", "Інше"]);
        fireEvent.click(screen.getByRole("button", {name: "Перемістити варіант 2 вище"}));
        expect((latest[0] as FormField).options).toEqual(["Інше", "Студент"]);
        fireEvent.click(screen.getByRole("button", {name: "Видалити варіант 1"}));
        expect((latest[0] as FormField).options).toEqual(["Студент"]);
        expect((screen.getByRole("button", {name: "Видалити варіант 1"}) as HTMLButtonElement).disabled).toBe(true);
    });

    it("marks empty and repeated options", () => {
        render(<Harness initial={[field("role", "select", {options: ["А", "А", ""]})]} index={0} editor="options" />);
        expect(screen.getByRole("textbox", {name: "Варіант 1"}).getAttribute("aria-invalid")).toBe("false");
        expect(screen.getByRole("textbox", {name: "Варіант 2"}).getAttribute("aria-invalid")).toBe("true");
        expect(screen.getByText("Такий варіант уже є.")).toBeTruthy();
        expect(screen.getByText("Заповніть варіант.")).toBeTruthy();
    });
});

describe("display condition editor", () => {
    it("allows «За умовою» only when an earlier single-answer question exists", () => {
        render(<Harness initial={[field("a", "text"), field("b", "text")]} index={0} editor="condition" />);
        expect((screen.getByRole("button", {name: "За умовою"}) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText("Умова можлива, коли вище є питання з однією відповіддю.")).toBeTruthy();
    });

    it("switches between «Завжди» and «За умовою»", () => {
        render(<Harness initial={[field("a", "checkbox"), field("b", "text")]} index={1} editor="condition" />);
        expect(screen.getByRole("button", {name: "Завжди"}).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(screen.getByRole("button", {name: "За умовою"}));
        expect((latest[1] as FormField).condition).toEqual({fieldKey: "a", operator: "equals", value: true});
        expect(screen.getByRole("button", {name: "Попереднє питання для умови 2"})).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Завжди"}));
        expect((latest[1] as FormField).condition).toBeUndefined();
    });

    it("stores a typed number value for a number source", () => {
        render(<Harness initial={[field("a", "number"), field("b", "text", {condition: {fieldKey: "a", operator: "equals", value: 0}})]} index={1} editor="condition" />);
        fireEvent.change(screen.getByRole("spinbutton", {name: "Значення умови 2"}), {target: {value: "5"}});
        expect((latest[1] as FormField).condition?.value).toBe(5);
    });
});
