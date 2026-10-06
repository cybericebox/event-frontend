// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {ManageTabs, manageTabPanelID} from "./ManageTabs";

afterEach(cleanup);

const tabs = [{value: "a", label: "Перша", count: 3}, {value: "b", label: "Друга"}, {value: "c", label: "Третя"}];

function Harness({onChange}: {onChange?: (value: string) => void}) {
    const [value, setValue] = useState("a");
    return <><ManageTabs idPrefix="t" label="Розділи" tabs={tabs} value={value} onChange={next => {setValue(next); onChange?.(next);}} /><div role="tabpanel" id={manageTabPanelID("t")}>{value}</div></>;
}

describe("ManageTabs", () => {
    it("keeps one tab in the tab order and every tab controls the panel", () => {
        render(<Harness />);
        const all = screen.getAllByRole("tab");
        expect(all.map(tab => tab.tabIndex)).toEqual([0, -1, -1]);
        expect(all.every(tab => tab.getAttribute("aria-controls") === manageTabPanelID("t"))).toBe(true);
        expect(screen.getByRole("tab", {name: /Перша/}).getAttribute("aria-selected")).toBe("true");
    });

    it("moves focus and selection with the arrows, Home and End, wrapping around", () => {
        const changed = vi.fn();
        render(<Harness onChange={changed} />);
        const list = screen.getByRole("tablist");
        fireEvent.keyDown(list, {key: "ArrowRight"});
        expect(document.activeElement).toBe(screen.getByRole("tab", {name: "Друга"}));
        fireEvent.keyDown(list, {key: "End"});
        expect(document.activeElement).toBe(screen.getByRole("tab", {name: "Третя"}));
        fireEvent.keyDown(list, {key: "ArrowRight"});
        expect(document.activeElement).toBe(screen.getByRole("tab", {name: /Перша/}));
        fireEvent.keyDown(list, {key: "ArrowLeft"});
        expect(document.activeElement).toBe(screen.getByRole("tab", {name: "Третя"}));
        fireEvent.keyDown(list, {key: "Home"});
        expect(changed).toHaveBeenLastCalledWith("a");
        expect(screen.getByRole("tabpanel").textContent).toBe("a");
    });
});
