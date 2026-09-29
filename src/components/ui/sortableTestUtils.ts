import {act, fireEvent} from "@testing-library/react";

// jsdom has no layout: every element gets a 40px-high box stacked by its index
// among its siblings, which is what the sortable measures for list items.
export function stackLayout() {
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
        const index = this.parentElement ? Array.prototype.indexOf.call(this.parentElement.children, this) : 0;
        const top = index * 50;
        return {x: 0, y: top, top, left: 0, right: 300, bottom: top + 40, width: 300, height: 40, toJSON: () => ({})} as DOMRect;
    };
    Element.prototype.scrollIntoView = () => {};
    return () => {Element.prototype.getBoundingClientRect = original;};
}

const tick = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));

// Keyboard drag: Space picks the item up, the arrows move it (positive steps
// go down), and Space drops it or Escape cancels.
export async function keyboardDrag(handle: HTMLElement, steps: number, finish: "drop" | "cancel" = "drop", during?: () => void) {
    handle.focus();
    fireEvent.keyDown(handle, {code: "Space", key: " "});
    await tick();
    for (let step = 0; step < Math.abs(steps); step++) {
        fireEvent.keyDown(document.activeElement ?? handle, {code: steps > 0 ? "ArrowDown" : "ArrowUp"});
        await tick();
    }
    during?.();
    fireEvent.keyDown(document.activeElement ?? handle, finish === "drop" ? {code: "Space", key: " "} : {code: "Escape", key: "Escape"});
    await tick();
}
