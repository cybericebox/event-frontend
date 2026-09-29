// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {useState} from "react";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {FormConditionEditor, FormDateSettings, FormFileSettings, FormOptionsEditor} from "./FormFieldControls";

afterEach(cleanup);

let latest: FormBlock[] = [];

function Harness({initial, index, editor}: {initial: FormBlock[]; index: number; editor: "options" | "condition" | "file" | "date"}) {
    const [blocks, setBlocks] = useState(initial);
    const Editor = editor === "options" ? FormOptionsEditor : editor === "file" ? FormFileSettings : editor === "date" ? FormDateSettings : FormConditionEditor;
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
    it("explains why a condition is unavailable without an earlier single-answer question", () => {
        render(<Harness initial={[field("a", "text"), field("b", "text")]} index={0} editor="condition" />);
        fireEvent.click(screen.getByRole("button", {name: "Завжди"}));
        expect((screen.getByRole("button", {name: "Додати умову"}) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText("Умову можна додати, коли вище є питання з однією відповіддю.")).toBeTruthy();
    });

    it("collapses to a one-line summary and expands to edit the rule", () => {
        render(<Harness initial={[field("a", "checkbox", {label: "Студент"}), field("b", "text")]} index={1} editor="condition" />);
        const toggle = screen.getByRole("button", {name: "Завжди"});
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        fireEvent.click(toggle);
        fireEvent.click(screen.getByRole("button", {name: "Додати умову"}));
        expect((latest[1] as FormField).condition).toEqual({fieldKey: "a", operator: "equals", value: true});
        expect(screen.getByRole("button", {name: "Якщо «Студент» = «Так»"}).getAttribute("aria-expanded")).toBe("true");
        fireEvent.click(screen.getByRole("button", {name: "Видалити умову питання 2"}));
        expect((latest[1] as FormField).condition).toBeUndefined();
        expect(screen.getByRole("button", {name: "Завжди"})).toBeTruthy();
    });

    it("starts open with a summary for an existing rule and stores typed numbers", () => {
        render(<Harness initial={[field("a", "number", {label: "Курс"}), field("b", "text", {condition: {fieldKey: "a", operator: "not_equals", value: 3}})]} index={1} editor="condition" />);
        expect(screen.getByRole("button", {name: "Якщо «Курс» ≠ «3»"}).getAttribute("aria-expanded")).toBe("true");
        fireEvent.change(screen.getByRole("spinbutton", {name: "Значення умови 2"}), {target: {value: "5"}});
        expect((latest[1] as FormField).condition?.value).toBe(5);
    });
});

describe("file formats", () => {
    it("tick Office as a group of Word, Excel and PowerPoint", () => {
        render(<Harness initial={[field("cv", "file", {fileTypes: ["pdf"]})]} index={0} editor="file" />);
        fireEvent.click(screen.getByRole("checkbox", {name: "Документи Office"}));
        expect((latest[0] as FormField).fileTypes).toEqual(["pdf", "word", "excel", "powerpoint"]);
        fireEvent.click(screen.getByRole("checkbox", {name: "Excel (XLS, XLSX, ODS)"}));
        expect((latest[0] as FormField).fileTypes).toEqual(["pdf", "word", "powerpoint"]);
        expect((screen.getByRole("checkbox", {name: "Документи Office"}) as HTMLInputElement).checked).toBe(false);
        fireEvent.click(screen.getByRole("checkbox", {name: "Архіви (ZIP, 7Z, RAR, TAR, TAR.GZ)"}));
        expect((latest[0] as FormField).fileTypes).toEqual(["pdf", "word", "powerpoint", "archive"]);
    });
});

describe("date conditions in the editor", () => {
    it("offer before and after for a date source", async () => {
        render(<Harness initial={[field("born", "date", {dateMode: "date"}), field("b", "text", {condition: {fieldKey: "born", operator: "before", value: "2008-01-01"}})]} index={1} editor="condition" />);
        expect(screen.getByRole("button", {name: /Якщо «born» раніше за 1 січня 2008/})).toBeTruthy();
        expect(screen.getByRole("button", {name: "Порівняння для умови 2"}).textContent).toContain("Раніше за");
    });
});

describe("date / time settings", () => {
    it("tick the date, the time or both, but not neither", () => {
        render(<Harness initial={[field("when", "date", {dateMode: "date", minDate: "2026-01-01"})]} index={0} editor="date" />);
        fireEvent.click(screen.getByRole("checkbox", {name: "Час"}));
        expect((latest[0] as FormField)).toMatchObject({dateMode: "datetime", minDate: undefined});
        fireEvent.click(screen.getByRole("checkbox", {name: "Дата"}));
        expect((latest[0] as FormField).dateMode).toBe("time");
        expect(screen.getByRole("group", {name: "Найраніша дата питання 1"})).toBeTruthy();
        fireEvent.click(screen.getByRole("checkbox", {name: "Час"}));
        expect((latest[0] as FormField).dateMode).toBe("none");
        expect(screen.getByText("Оберіть дату, час або обидва.")).toBeTruthy();
    });
});
