// @vitest-environment jsdom
import {act} from "react";
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

    describe("starting lab", () => {
        const empty = {...runtimeFixture, Access: [], Ready: false, Phase: "Pending"};
        const queue = (Reason: string) => ({...empty, Queue: {Position: 1, Length: 1, Reason, Message: "", Pods: 1, Pending: 1}});
        const renderStarting = (lab: typeof empty) => {
            const actions = callbacks();
            return render(<LabAccessBlock lab={lab} lifecycle={{...runningLab, RuntimeState: "preparing"}} pending={false} link={{status: "idle"}} busyKey={null} {...actions} />);
        };
        const visibleNote = (container: HTMLElement) => {
            const note = container.querySelector<HTMLElement>(".event-loading-note");
            return note && note.style.visibility !== "hidden" ? note.textContent : null;
        };
        afterEach(() => vi.useRealTimers());

        it("shows the plain starting line without a queue position", () => {
            vi.useFakeTimers();
            const {container} = renderStarting(queue("WaitingForTurn"));
            expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Готуємо лабораторію…");
            expect(container.textContent).not.toMatch(/черз|1 із/);
            expect(visibleNote(container)).toBeNull();
        });
        it("adds the long-wait line after 30 s", () => {
            vi.useFakeTimers();
            const {container} = renderStarting(queue("PreparingImages"));
            act(() => { vi.advanceTimersByTime(29_999); });
            expect(visibleNote(container)).toBeNull();
            act(() => { vi.advanceTimersByTime(1); });
            expect(visibleNote(container)).toContain("Ще трохи — готуємо все для вас.");
        });
        it.each(["InsufficientResources", "NoSchedulableNodes", "TenantQuota"])("shows the no-resources line for %s only after 30 s", reason => {
            vi.useFakeTimers();
            const {container} = renderStarting(queue(reason));
            act(() => { vi.advanceTimersByTime(29_999); });
            expect(visibleNote(container)).toBeNull();
            act(() => { vi.advanceTimersByTime(1); });
            expect(visibleNote(container)).toBe("Зараз бракує ресурсів. Лабораторія запуститься, щойно вони звільняться.");
        });
        it("does not restart the wait when the reason changes", () => {
            vi.useFakeTimers();
            const actions = callbacks();
            const view = renderStarting(queue("WaitingForTurn"));
            act(() => { vi.advanceTimersByTime(20_000); });
            view.rerender(<LabAccessBlock lab={queue("TenantQuota")} lifecycle={{...runningLab, RuntimeState: "preparing"}} pending={false} link={{status: "idle"}} busyKey={null} {...actions} />);
            act(() => { vi.advanceTimersByTime(10_000); });
            expect(visibleNote(view.container)).toContain("бракує ресурсів");
        });
        it("still shows the error on failure", () => {
            vi.useFakeTimers();
            const actions = callbacks();
            const {container} = render(<LabAccessBlock lab={{...queue("WaitingForTurn"), Phase: "failed"}} lifecycle={{...runningLab, RuntimeState: "preparing"}} pending={false} link={{status: "idle"}} busyKey={null} {...actions} />);
            expect(container.querySelector("[data-load-error]")).toBeTruthy();
            expect(container.querySelector(".event-loading-note")).toBeNull();
        });
    });
});
