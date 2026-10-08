// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {LabAccessBlock} from "./LabAccessBlock";
import {completedLab, runningLab, runtimeFixture} from "@/test/labLifecycle";
import {EventBrandProvider} from "@/components/event/EventBrandLogo";

afterEach(cleanup);
const callbacks = () => ({onOpen: vi.fn(), onRetry: vi.fn(), onReload: vi.fn()});
const stale = {...runtimeFixture, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://old.test"}]};
describe("LabAccessBlock", () => {
    it.each(["solved", "manual", "stage", "event"] as const)("gives settled closure priority over every pending/error/access state: %s", reason => {
        const actions = callbacks();
        const {container} = render(<LabAccessBlock lab={stale} lifecycle={{...completedLab, CloseReason: reason}} pending error={new Error("offline")} link={{status: "error", error: new Error("old link")}} busyKey="web:80" {...actions} />);
        expect(container.querySelector("[data-empty-state] .ib-empty__icon svg")).toBeTruthy();
        expect(container.querySelector("[data-load-error]")).toBeNull();
        expect(container.querySelector(".event-loading-logo")).toBeNull();
        expect(container.querySelector("button")).toBeNull();
        expect(container.textContent).not.toContain("https://old.test");
    });
    it("uses inherited event logo for preparation and centered shared error with retry when unavailable", () => {
        const actions = callbacks();
        const view = render(<EventBrandProvider logoURL="https://logo.test/event.png"><LabAccessBlock lab={stale} lifecycle={{...runningLab, RuntimeState: "preparing"}} pending={false} link={{status: "idle"}} busyKey={null} {...actions} /></EventBrandProvider>);
        expect(view.container.querySelector(".event-loading-logo")?.getAttribute("src")).toBe("https://logo.test/event.png");
        view.rerender(<LabAccessBlock lab={stale} lifecycle={{...runningLab, RuntimeState: "unavailable"}} pending={false} link={{status: "idle"}} busyKey={null} {...actions} />);
        expect(view.container.querySelector("[data-load-error] .ib-empty__hint")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Спробувати ще раз"})); expect(actions.onReload).toHaveBeenCalledOnce();
        expect(view.container.querySelector(".ib-copy")).toBeNull();
    });
    it("keeps matching cached access visible through a background fetch and supports lifecycle-free legacy access", () => {
        const actions = callbacks();
        const view = render(<LabAccessBlock lab={stale} lifecycle={runningLab} pending error={new Error("background")} link={{status: "idle"}} busyKey={null} {...actions} />);
        expect(view.container.querySelector(".ib-copy")?.textContent).toContain("https://old.test");
        expect(view.container.querySelector("[data-load-error]")).toBeNull();
        view.rerender(<LabAccessBlock lab={{...stale, Lab: null}} lifecycle={null} pending={false} link={{status: "idle"}} busyKey={null} {...actions} />);
        expect(view.container.querySelector(".ib-copy")).toBeTruthy();
    });
});
