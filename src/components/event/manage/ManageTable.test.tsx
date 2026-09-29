// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, renderHook, screen} from "@testing-library/react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ManageTable, ManageTablePagination, useCursorPages} from "./ManageTable";

afterEach(cleanup);

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Tag: "test", Name: "Test",
    StartTime: "2026-09-28T00:00:00Z", FinishTime: null, Status: 2,
    Participation: 0, Registration: 1, CanViewResults: false, CanViewParticipants: false,
    PreviewDescription: "", PreviewPicture: "", LogoURL: "", FaviconURL: "",
    ShowStartCountdown: true, ShowFinishCountdown: true, FinishCountdownMinutes: 10,
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} satisfies PublicEventInfo;

function table(state: "loading" | "error" | "empty" | "ready", onRetry = vi.fn()) {
    return render(<ManageTable event={event} state={state} loadingLabel="Завантажуємо" emptyMessage="Порожньо" errorMessage="Помилка" onRetry={onRetry}
        footer={<div>footer</div>} head={<tr><th scope="col">Назва</th></tr>}><tbody><tr><td>рядок</td></tr></tbody></ManageTable>);
}

describe("manage table states", () => {
    it("renders the loader, the empty state, the error and the rows inside the same block", () => {
        table("loading");
        expect(screen.getByRole("status", {name: "Завантажуємо"}).closest("tbody")).toBeTruthy();
        expect(screen.getByRole("columnheader", {name: "Назва"})).toBeTruthy();
        cleanup();
        table("empty");
        expect(screen.getByText("Порожньо").closest("[data-empty-state]")?.closest("tbody")).toBeTruthy();
        expect(screen.getByRole("columnheader", {name: "Назва"})).toBeTruthy();
        expect(screen.getByText("footer")).toBeTruthy();
        cleanup();
        const onRetry = vi.fn();
        table("error", onRetry);
        fireEvent.click(screen.getByRole("button", {name: "Спробувати ще раз"}));
        expect(onRetry).toHaveBeenCalledOnce();
        cleanup();
        table("ready");
        expect(screen.getByRole("cell", {name: "рядок"})).toBeTruthy();
    });
});

describe("manage table error code", () => {
    it("shows the error code of a failed load", () => {
        render(<ManageTable event={event} state="error" loadingLabel="L" emptyMessage="E" errorMessage="Помилка" onRetry={vi.fn()} error={{status: 500}} head={<tr><th scope="col">Назва</th></tr>} />);
        expect(screen.getByText("Код помилки: 500")).toBeTruthy();
    });
});

describe("manage table pagination", () => {
    it("shows the total and page X of Y and walks pages", () => {
        const onNext = vi.fn();
        const onPrevious = vi.fn();
        render(<ManageTablePagination event={event} page={2} pageSize={25} total={60} hasNext onPrevious={onPrevious} onNext={onNext} onPageSize={vi.fn()} />);
        expect(screen.getByText("Усього: 60")).toBeTruthy();
        expect(screen.getByText("Сторінка 2 з 3")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Далі"}));
        fireEvent.click(screen.getByRole("button", {name: "Назад"}));
        expect(onNext).toHaveBeenCalledOnce();
        expect(onPrevious).toHaveBeenCalledOnce();
    });

    it("disables both directions on a single empty page", () => {
        render(<ManageTablePagination event={event} page={1} pageSize={25} total={0} hasNext={false} onPrevious={vi.fn()} onNext={vi.fn()} onPageSize={vi.fn()} />);
        expect(screen.getByText("Сторінка 1 з 1")).toBeTruthy();
        expect((screen.getByRole("button", {name: "Далі"}) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole("button", {name: "Назад"}) as HTMLButtonElement).disabled).toBe(true);
    });
});

describe("cursor pages", () => {
    it("remembers visited cursors and restarts on reset and page size", () => {
        const {result} = renderHook(() => useCursorPages());
        expect(result.current).toMatchObject({cursor: null, page: 1, pageSize: 25});
        act(() => result.current.next("a"));
        act(() => result.current.next("b"));
        expect(result.current).toMatchObject({cursor: "b", page: 3});
        act(() => result.current.previous());
        expect(result.current).toMatchObject({cursor: "a", page: 2});
        act(() => result.current.next(undefined));
        expect(result.current.page).toBe(2);
        act(() => result.current.reset());
        expect(result.current).toMatchObject({cursor: null, page: 1});
        act(() => result.current.next("a"));
        act(() => result.current.setPageSize(100));
        expect(result.current).toMatchObject({cursor: null, page: 1, pageSize: 100});
    });
});
