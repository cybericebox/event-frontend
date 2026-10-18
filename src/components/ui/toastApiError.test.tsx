// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import toast from "react-hot-toast";
import {EventActionToaster} from "./EventActionToaster";
import {toastApiError, toastFailure} from "./toastApiError";

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

    it("offers the retry for the overload code (431) without Retry-After too", async () => {
        render(<EventActionToaster />);
        act(() => {toastApiError(new TestApiError(503, 431), "Не вдалося зберегти", vi.fn());});
        expect(await screen.findByText("Сервер перевантажений, спробуйте за кілька секунд")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
    });

    it("keeps a personal rate limit (429) on its own message with the wait, without the retry", async () => {
        render(<EventActionToaster />);
        act(() => {toastApiError(new TestApiError(429, 428, 30), "Не вдалося зберегти", vi.fn());});
        expect(await screen.findByText("Забагато спроб. Спробуйте ще раз через 30 с.")).toBeTruthy();
        expect(screen.queryByText("Сервер перевантажений, спробуйте за кілька секунд")).toBeNull();
        expect(screen.queryByRole("button", {name: "Спробувати ще раз"})).toBeNull();
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

    it("toastFailure swaps the caller's text for the overloaded line only on an overload 503", async () => {
        render(<EventActionToaster />);
        act(() => {
            toastFailure(new TestApiError(503, 2608, 1), "Не вдалося видалити");
            toastFailure(new TestApiError(503), "Не вдалося зберегти");
            toastFailure(new TestApiError(429, undefined, 1), "Не вдалося надіслати");
        });
        expect(await screen.findByText("Сервер перевантажений, спробуйте за кілька секунд")).toBeTruthy();
        expect(screen.queryByText("Не вдалося видалити")).toBeNull();
        expect(screen.getByText("Не вдалося зберегти")).toBeTruthy();
        expect(screen.getByText("Не вдалося надіслати")).toBeTruthy();
    });

    it("toastFailure keeps a personal rate limit (429) on its catalog message with the wait", async () => {
        render(<EventActionToaster />);
        act(() => {toastFailure(new TestApiError(429, 428, 30), "Не вдалося надіслати");});
        expect(await screen.findByText("Забагато спроб. Спробуйте ще раз через 30 с.")).toBeTruthy();
        expect(screen.queryByText("Не вдалося надіслати")).toBeNull();
        expect(screen.queryByText("Сервер перевантажений, спробуйте за кілька секунд")).toBeNull();
    });
});
