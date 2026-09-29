// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {TableColumnsPopover} from "./TableControls";
import type {TableColumn} from "./listColumns";

afterEach(cleanup);

// The grip tooltip reads hover capability; jsdom has no matchMedia.
window.matchMedia ??= ((query: string) => ({matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false})) as typeof window.matchMedia;

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

describe("columns keyboard", () => {
    it("moves the focused card with Alt+Arrow keys and keeps the name column first", () => {
        const onChange = vi.fn();
        render(<TableColumnsPopover columns={columns} canManage onChange={onChange} onReset={vi.fn()} />);
        const popover = openPopover("Колонки");
        const email = within(popover).getByText("Пошта").closest("li") as HTMLElement;
        fireEvent.keyDown(within(email).getByRole("switch"), {key: "ArrowDown", altKey: true});
        expect(onChange.mock.lastCall?.[0].map((column: TableColumn) => column.key)).toEqual(["@name", "city", "@email"]);
        onChange.mockClear();
        fireEvent.keyDown(within(email).getByRole("switch"), {key: "ArrowUp", altKey: true});
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.keyDown(within(email).getByRole("switch"), {key: "ArrowDown"});
        expect(onChange).not.toHaveBeenCalled();
    });
});
