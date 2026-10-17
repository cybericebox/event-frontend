// @vitest-environment jsdom
import {afterEach, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {EventLoadError} from "./EventLoadError";

class TestApiError extends Error {
    constructor(readonly status: number, readonly code?: number, readonly retryAfter?: number) {
        super(`request failed: ${status}`);
    }
}

afterEach(cleanup);

it("titles a load error caused by an overloaded server with the overloaded line", () => {
    render(<EventLoadError message="Не вдалося завантажити завдання" error={new TestApiError(503, undefined, 1)} />);
    expect(screen.getByText("Сервер перевантажений, спробуйте за кілька секунд")).toBeTruthy();
    expect(screen.queryByText("Не вдалося завантажити завдання")).toBeNull();
});

it("keeps the context message for other errors", () => {
    render(<EventLoadError message="Не вдалося завантажити завдання" error={new TestApiError(503)} />);
    expect(screen.getByText("Не вдалося завантажити завдання")).toBeTruthy();
});
