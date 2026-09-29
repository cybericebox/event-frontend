// @vitest-environment jsdom
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {useState} from "react";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Sortable, useSortableItem} from "./Sortable";
import {moveItem} from "./sortableOrder";
import {keyboardDrag, stackLayout} from "./sortableTestUtils";

let restore: () => void;
beforeAll(() => {restore = stackLayout();});
afterAll(() => restore());
afterEach(cleanup);

function Row({id, locked, onAction}: {id: string; locked: boolean; onAction: () => void}) {
    const sortable = useSortableItem(id, locked);
    return <li {...sortable.itemProps} {...sortable.bodyProps}>
        <button type="button" {...sortable.handleProps} aria-label={`drag ${id}`}>⋮</button>
        <span>{id}</span>
        <button type="button" onClick={onAction}>{`action ${id}`}</button>
    </li>;
}

function Harness({onDragStateChange, onAction = () => {}, locked = ""}: {onDragStateChange?: (dragging: boolean) => void; onAction?: () => void; locked?: string}) {
    const [ids, setIDs] = useState(["a", "b", "c", "d", "e"]);
    return <Sortable ids={ids} itemName={id => id} onMove={(from, to) => setIDs(current => moveItem(current, from, to))} onDragStateChange={onDragStateChange}>
        <ol aria-label="list">{ids.map(id => <Row key={id} id={id} locked={id === locked} onAction={onAction} />)}</ol>
    </Sortable>;
}

const order = () => [...screen.getByRole("list", {name: "list"}).children].map(item => item.querySelector("span")?.textContent);
const handle = (id: string) => screen.getByRole("button", {name: `drag ${id}`});

describe("Sortable keyboard moves", () => {
    it("moves an item several positions down in one drag", async () => {
        render(<Harness />);
        await keyboardDrag(handle("a"), 3);
        expect(order()).toEqual(["b", "c", "d", "a", "e"]);
    });

    it("moves an item to the first and to the last position", async () => {
        render(<Harness />);
        await keyboardDrag(handle("d"), -3);
        expect(order()).toEqual(["d", "a", "b", "c", "e"]);
        await keyboardDrag(handle("b"), 4);
        expect(order()).toEqual(["d", "a", "c", "e", "b"]);
    });

    it("never drops onto a locked item", async () => {
        render(<Harness locked="a" />);
        await keyboardDrag(handle("d"), -3);
        expect(order()).toEqual(["a", "d", "b", "c", "e"]);
    });

    it("keeps the order when the drag is cancelled", async () => {
        render(<Harness />);
        await keyboardDrag(handle("a"), 2, "cancel");
        expect(order()).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("reports the drag start and its end on drop and on cancel", async () => {
        const states: boolean[] = [];
        render(<Harness onDragStateChange={dragging => states.push(dragging)} />);
        await keyboardDrag(handle("c"), 1, "drop", () => expect(states).toEqual([true]));
        await keyboardDrag(handle("a"), 1, "cancel");
        expect(states).toEqual([true, false, true, false]);
    });

    it("reports the end only after the drop animation when motion is allowed", async () => {
        const reduced = window.matchMedia;
        window.matchMedia = (query: string) => ({...reduced(query), matches: false});
        const states: boolean[] = [];
        render(<Harness onDragStateChange={dragging => states.push(dragging)} />);
        await keyboardDrag(handle("a"), 2);
        expect(order()).toEqual(["b", "c", "a", "d", "e"]);
        expect(states).toEqual([true]);
        await waitFor(() => expect(states).toEqual([true, false]));
        window.matchMedia = reduced;
    });

    it("marks the dragged item's slot as the drop indicator", async () => {
        render(<Harness />);
        await keyboardDrag(handle("b"), 1, "cancel", () => {
            expect(handle("b").closest("li")?.hasAttribute("data-sortable-source")).toBe(true);
        });
        expect(handle("b").closest("li")?.hasAttribute("data-sortable-source")).toBe(false);
    });

    it("never starts a drag from a button inside the item", async () => {
        const action = vi.fn();
        const states: boolean[] = [];
        render(<Harness onAction={action} onDragStateChange={dragging => states.push(dragging)} />);
        const button = screen.getByRole("button", {name: "action a"});
        button.focus();
        fireEvent.keyDown(button, {code: "Space", key: " "});
        fireEvent.pointerDown(button, {button: 0, isPrimary: true, pointerId: 1, clientX: 5, clientY: 5});
        fireEvent.pointerMove(document, {pointerId: 1, clientX: 5, clientY: 80});
        fireEvent.pointerUp(document, {pointerId: 1});
        fireEvent.click(button);
        expect(states).toEqual([]);
        expect(action).toHaveBeenCalledOnce();
        expect(order()).toEqual(["a", "b", "c", "d", "e"]);
    });
});
