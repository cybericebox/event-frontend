// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import toast from "react-hot-toast";
import {EventActionToaster} from "./EventActionToaster";
import {toastApiError} from "./toastApiError";

class TestApiError extends Error {
    constructor(readonly status: number, readonly code?: number, readonly retryAfter?: number) {
        super(`request failed: ${status}`);
    }
}

afterEach(() => {
    act(() => toast.remove());
    cleanup();
});

describe("toastApiError", () => {
    it("offers a retry for an overloaded server; the click closes the toast and runs it once", async () => {
        const retry = vi.fn();
        render(<EventActionToaster />);
        act(() => {toastApiError(new TestApiError(503, undefined, 1), "Не вдалося зберегти", retry);});
        expect(await screen.findByText("Сервер перевантажений, спробуйте за кілька секунд")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Закрити сповіщення Сервер перевантажений, спробуйте за кілька секунд"})).toBeTruthy();
        act(() => fireEvent.click(screen.getByRole("button", {name: "Спробувати ще раз"})));
        expect(retry).toHaveBeenCalledTimes(1);
        await vi.waitFor(() => expect(screen.getByRole("alert").getAttribute("data-visible")).toBe("false"));
    });

    it("shows only the message for other errors or without a handler", async () => {
        render(<EventActionToaster />);
        act(() => {
            toastApiError(new TestApiError(500), "Не вдалося зберегти", vi.fn());
            toastApiError(new TestApiError(503, undefined, 1), "Не вдалося зберегти");
        });
        expect(await screen.findByText("Не вдалося зберегти")).toBeTruthy();
        expect(screen.getByText("Сервер перевантажений, спробуйте за кілька секунд")).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Спробувати ще раз"})).toBeNull();
    });
});
