// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {SortableList} from "./SortableList";

afterEach(cleanup);

describe("SortableList row layout", () => {
    it("puts grip, name, then ↑ ↓, then the row's own actions (edit, delete last)", () => {
        render(<SortableList ariaLabel="Групи" items={["Web"]} itemID={item => item} itemName={item => item} onReorder={vi.fn()}
            renderItem={item => ({content: <span>{item}</span>, actions: <><button type="button" aria-label="Редагувати">e</button><button type="button" aria-label="Видалити">d</button></>})} />);
        const row = screen.getByRole("listitem");
        const labels = Array.from(row.querySelectorAll("button")).map(button => button.getAttribute("aria-label") ?? button.textContent);
        expect(labels[0]).toContain("Web");
        expect(labels.slice(-4).map(label => label?.replace(/ Web$/, ""))).toEqual(["Підняти", "Опустити", "Редагувати", "Видалити"]);
    });
});
