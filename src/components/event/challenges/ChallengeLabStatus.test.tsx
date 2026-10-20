// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {runningLab, completedLab, runtimeFixture} from "@/test/labLifecycle";
import {ChallengeLabStatus} from "./ChallengeLabStatus";
afterEach(cleanup);
it("ready has no status line, even after a failed background refresh", () => {
 const view = render(<ChallengeLabStatus lab={runtimeFixture} lifecycle={runningLab} withdrawn={false} error={new Error("poll")} onRetry={() => {}} />);
 expect(view.container.textContent).toBe("");
});
it("closure wins over a pending or stale runtime", () => {
 render(<ChallengeLabStatus lab={runtimeFixture} lifecycle={completedLab} withdrawn={false} onRetry={() => {}} />);
 expect(screen.getByRole("status").textContent).toBe("Середовище закрито.");
});
it("mismatched revision starts with the event logo, without exposing cached access", () => {
 const {container} = render(<ChallengeLabStatus lab={runtimeFixture} lifecycle={{...runningLab, Revision: "99"}} withdrawn={false} onRetry={() => {}} />);
 expect(screen.getByRole("status").textContent).toBe("Лабораторія запускається…");
 expect(container.querySelector(".ib-busy-mark")).toBeTruthy();
});
it("unavailable is the compact shared error with retry", () => {
 const retry = vi.fn(); render(<ChallengeLabStatus lifecycle={{...runningLab, RuntimeState: "unavailable"}} withdrawn={false} onRetry={retry} />);
 expect(screen.getByText("Лабораторія недоступна")).toBeTruthy(); fireEvent.click(screen.getByRole("button", {name: "Спробувати ще раз"})); expect(retry).toHaveBeenCalledOnce();
});
