// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {useRef} from "react";
import {useRovingToolbar} from "./useRovingToolbar";

afterEach(cleanup);

function Toolbar() {
    const ref = useRef<HTMLDivElement>(null);
    useRovingToolbar(ref);
    return <div role="toolbar" aria-label="Форматування" ref={ref}>
        <button type="button">A</button><button type="button" disabled>B</button><button type="button">C</button><button type="button">D</button>
    </div>;
}

describe("useRovingToolbar", () => {
    it("is one Tab stop and moves with the arrows over the enabled buttons", () => {
        render(<Toolbar />);
        const buttons = screen.getAllByRole("button");
        expect([0, 2, 3].map(index => buttons[index].tabIndex)).toEqual([0, -1, -1]);
        buttons[0].focus();
        fireEvent.keyDown(buttons[0], {key: "ArrowRight"});
        expect(document.activeElement).toBe(buttons[2]);
        expect([0, 2, 3].map(index => buttons[index].tabIndex)).toEqual([-1, 0, -1]);
        fireEvent.keyDown(buttons[2], {key: "End"});
        expect(document.activeElement).toBe(buttons[3]);
        fireEvent.keyDown(buttons[3], {key: "ArrowRight"});
        expect(document.activeElement).toBe(buttons[0]);
        fireEvent.keyDown(buttons[0], {key: "ArrowLeft"});
        expect(document.activeElement).toBe(buttons[3]);
    });
});
