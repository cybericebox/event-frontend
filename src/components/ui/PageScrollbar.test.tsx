// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {PageScrollbar} from "./PageScrollbar";

describe("PageScrollbar", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(window, "innerHeight", {configurable: true, value: 800});
        Object.defineProperty(window, "scrollY", {configurable: true, value: 0, writable: true});
        Object.defineProperty(document.documentElement, "scrollHeight", {configurable: true, value: 3200});
        vi.stubGlobal("ResizeObserver", class {observe() {} disconnect() {}});
        vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    });
    afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();});

    it("enables the overlay only while mounted and removes it on cleanup", () => {
        const {unmount} = render(<PageScrollbar />);
        expect(document.documentElement.hasAttribute("data-page-scrollbar")).toBe(true);
        expect(screen.getByRole("scrollbar").getAttribute("aria-controls")).toBe("main");
        unmount();
        expect(document.documentElement.hasAttribute("data-page-scrollbar")).toBe(false);
    });

    it("tracks scrolling, appears temporarily and supports keyboard navigation", () => {
        render(<PageScrollbar />);
        const bar = screen.getByRole("scrollbar");
        expect(bar.getAttribute("data-visible")).toBe("false");
        act(() => {window.scrollY = 1200; fireEvent.scroll(window); vi.advanceTimersByTime(20);});
        expect(bar.getAttribute("aria-valuenow")).toBe("50");
        expect(bar.getAttribute("data-visible")).toBe("true");
        act(() => {vi.advanceTimersByTime(1400);});
        expect(bar.getAttribute("data-visible")).toBe("false");
        fireEvent.keyDown(bar, {key: "End"});
        expect(window.scrollTo).toHaveBeenLastCalledWith({top: 2400, behavior: "instant"});
        fireEvent.keyDown(bar, {key: "Home"});
        expect(window.scrollTo).toHaveBeenLastCalledWith({top: 0, behavior: "instant"});
    });

    it("does not show an unusable control on a page that fits", () => {
        Object.defineProperty(document.documentElement, "scrollHeight", {configurable: true, value: 800});
        render(<PageScrollbar />);
        expect(screen.queryByRole("scrollbar")).toBeNull();
    });

    it("drags the thumb and stops moving the page after pointer cancellation", () => {
        render(<PageScrollbar />);
        const bar = screen.getByRole("scrollbar");
        bar.setPointerCapture = vi.fn();
        function pointer(type: string, y: number) {
            const event = new MouseEvent(type, {bubbles: true, clientY: y, button: 0});
            Object.defineProperty(event, "pointerId", {value: 7});
            fireEvent(bar, event);
        }
        pointer("pointerdown", 10);
        pointer("pointermove", 208);
        expect(window.scrollTo).toHaveBeenLastCalledWith({top: 800, behavior: "instant"});
        pointer("pointercancel", 208);
        vi.mocked(window.scrollTo).mockClear();
        pointer("pointermove", 406);
        expect(window.scrollTo).not.toHaveBeenCalled();
    });
});
