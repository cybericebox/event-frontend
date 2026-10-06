// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {SortHeader, TableFilterChips, TableFiltersButton} from "./TableFilters";
import type {FilterSpec} from "./tableFilterModel";

afterEach(cleanup);

const specs: FilterSpec[] = [
    {key: "@name", label: "Імʼя", kind: "contains"},
    {key: "@members", label: "Учасники", kind: "number"},
    {key: "@status", label: "Статус", kind: "any", options: [{value: "admitted", label: "Допущена"}]},
];

describe("filters popover", () => {
    it("edits drafts of every column type", () => {
        const onChange = vi.fn();
        render(<TableFiltersButton specs={specs} drafts={{}} onChange={onChange} active={0} />);
        fireEvent.click(screen.getByRole("button", {name: "Фільтри"}));
        const popover = screen.getByRole("dialog");
        fireEvent.change(within(popover).getByRole("searchbox", {name: "«Імʼя» містить"}), {target: {value: "ol"}});
        expect(onChange).toHaveBeenLastCalledWith({"@name": {op: "contains", text: "ol"}});
        fireEvent.change(within(popover).getByRole("spinbutton", {name: "Значення для «Учасники»"}), {target: {value: "2"}});
        expect(onChange).toHaveBeenLastCalledWith({"@members": {from: "2"}});
        fireEvent.click(within(popover).getByRole("checkbox", {name: "Допущена"}));
        expect(onChange).toHaveBeenLastCalledWith({"@status": {values: ["admitted"]}});
    });
});

describe("filter chips", () => {
    it("removes one filter, the search, or all of them", () => {
        const onChange = vi.fn();
        const onReset = vi.fn();
        const onRemoveSearch = vi.fn();
        render(<TableFilterChips specs={specs} drafts={{"@name": {text: "ol"}, "@members": {op: "between", from: "2"}}} onChange={onChange} onReset={onReset}
            extra={[{key: "@search", text: "Пошук: «x»", onRemove: onRemoveSearch}]} />);
        const chips = screen.getByRole("group", {name: "Активні фільтри"});
        expect(within(chips).getByText("Учасники: від 2")).toBeTruthy();
        fireEvent.click(within(chips).getByRole("button", {name: "Прибрати фільтр «Імʼя: містить «ol»»"}));
        expect(onChange).toHaveBeenLastCalledWith({"@members": {op: "between", from: "2"}});
        fireEvent.click(within(chips).getByRole("button", {name: "Прибрати фільтр «Пошук: «x»»"}));
        expect(onRemoveSearch).toHaveBeenCalledOnce();
        fireEvent.click(within(chips).getByRole("button", {name: "Скинути фільтри"}));
        expect(onReset).toHaveBeenCalledOnce();
    });

    it("renders nothing without active filters", () => {
        const {container} = render(<TableFilterChips specs={specs} drafts={{}} onChange={vi.fn()} onReset={vi.fn()} />);
        expect(container.innerHTML).toBe("");
    });
});

describe("sortable header", () => {
    it("shows aria-sort and toggles the direction", () => {
        const onSort = vi.fn();
        render(<table><thead><tr>
            <SortHeader columnKey="@name" label="Імʼя" sort={{key: "@name", desc: false}} onSort={onSort} />
            <SortHeader columnKey="@date" label="Дата" sort={{key: "@name", desc: false}} onSort={onSort} />
        </tr></thead></table>);
        const [name, date] = screen.getAllByRole("columnheader");
        expect(name.getAttribute("aria-sort")).toBe("ascending");
        expect(date.getAttribute("aria-sort")).toBe("none");
        fireEvent.click(within(name).getByRole("button", {name: "Імʼя"}));
        expect(onSort).toHaveBeenLastCalledWith({key: "@name", desc: true});
        fireEvent.click(within(date).getByRole("button", {name: "Дата"}));
        expect(onSort).toHaveBeenLastCalledWith({key: "@date", desc: false});
    });
});
