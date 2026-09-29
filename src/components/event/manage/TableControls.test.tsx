// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {TableColumnsPopover, TableFiltersPopover} from "./TableControls";
import type {TableColumn} from "./listColumns";

afterEach(cleanup);

const columns: TableColumn[] = [
    {key: "@name", label: "Ім’я", visible: true, locked: true},
    {key: "@email", label: "Пошта", visible: true},
    {key: "city", label: "Місто", visible: false},
];

function openPopover(name: string) {
    fireEvent.click(screen.getByRole("button", {name}));
    return screen.getByRole("dialog");
}

describe("columns popover", () => {
    it("lists every column, keeps the name column shown and first, and reorders", () => {
        const onChange = vi.fn();
        const onReset = vi.fn();
        render(<TableColumnsPopover columns={columns} canManage onChange={onChange} onReset={onReset} />);
        const popover = openPopover("Колонки");
        expect(within(popover).getByText("Налаштування спільне для всіх організаторів заходу.")).toBeTruthy();
        const switches = within(popover).getAllByRole("switch") as HTMLInputElement[];
        expect(switches.map(item => [item.checked, item.disabled])).toEqual([[true, true], [true, false], [false, false]]);
        expect((within(popover).getByRole("button", {name: "Перемістити «Пошта» вище"}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(switches[2]);
        expect(onChange).toHaveBeenLastCalledWith([columns[0], columns[1], {...columns[2], visible: true}]);
        fireEvent.click(within(popover).getByRole("button", {name: "Перемістити «Пошта» нижче"}));
        expect(onChange.mock.lastCall?.[0].map((column: TableColumn) => column.key)).toEqual(["@name", "city", "@email"]);
        fireEvent.click(within(popover).getByRole("button", {name: "Скинути"}));
        expect(onReset).toHaveBeenCalledOnce();
    });

    it("is read-only without manage rights", () => {
        render(<TableColumnsPopover columns={columns} canManage={false} onChange={vi.fn()} onReset={vi.fn()} />);
        const popover = openPopover("Колонки");
        expect((within(popover).getAllByRole("switch") as HTMLInputElement[]).every(item => item.disabled)).toBe(true);
        expect(within(popover).queryByRole("button", {name: "Скинути"})).toBeNull();
    });
});

describe("filters popover", () => {
    const fields = [
        {id: "1", type: "field" as const, key: "city", label: "Місто", input: "text" as const},
        {id: "2", type: "field" as const, key: "langs", label: "Мови", input: "multi_select" as const, options: ["Go", "Rust"]},
    ];

    it("edits text and choice drafts and shows the active count", () => {
        const onChange = vi.fn();
        render(<TableFiltersPopover fields={fields} drafts={{langs: {values: ["Go"]}}} onChange={onChange} active={1} />);
        const popover = openPopover("Фільтри: 1");
        fireEvent.change(within(popover).getByRole("searchbox", {name: "«Місто» містить"}), {target: {value: "Київ"}});
        expect(onChange).toHaveBeenLastCalledWith({langs: {values: ["Go"]}, city: {text: "Київ"}});
        fireEvent.click(within(popover).getByRole("checkbox", {name: "Rust"}));
        expect(onChange).toHaveBeenLastCalledWith({langs: {values: ["Go", "Rust"]}});
    });

    it("shows an empty state when the form has no fields", () => {
        render(<TableFiltersPopover fields={[]} drafts={{}} onChange={vi.fn()} active={0} />);
        expect(within(openPopover("Фільтри")).getByText("У формі немає полів для фільтрів.")).toBeTruthy();
    });
});
