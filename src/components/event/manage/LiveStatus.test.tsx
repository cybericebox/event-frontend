// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {LiveStatus} from "./LiveStatus";

afterEach(cleanup);

const at = new Date(2026, 8, 29, 14, 5, 9).getTime();

describe("live status", () => {
    it("shows the stream state, the last update and explains the mode", () => {
        render(<LiveStatus freshness={{kind: "stream", mode: "live", pollSeconds: 10}} updatedAt={at} />);
        expect(screen.getByText("Наживо")).toBeTruthy();
        expect(screen.getByText("Оновлено 14:05:09")).toBeTruthy();
        expect(screen.getByRole("tooltip").textContent).toBe("Зміни надходять одразу через живий потік.");
    });

    it("says when the stream is down or reconnecting", () => {
        render(<LiveStatus freshness={{kind: "stream", mode: "fallback", pollSeconds: 10}} updatedAt={at} />);
        expect(screen.getByText("Не підключено")).toBeTruthy();
        expect(screen.getByRole("tooltip").textContent).toBe("Живий потік недоступний. Дані оновлюються кожні 10 с.");
        cleanup();
        render(<LiveStatus freshness={{kind: "stream", mode: "connecting", pollSeconds: 10}} updatedAt={0} />);
        expect(screen.getByText("Перепідключення…")).toBeTruthy();
        expect(screen.getByText("Ще не оновлено")).toBeTruthy();
    });

    it("offers a refresh button when the list does not refresh itself", () => {
        const onRefresh = vi.fn();
        render(<LiveStatus freshness={{kind: "manual", onRefresh, refreshing: false}} updatedAt={at} />);
        expect(screen.queryByText("Наживо")).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Оновити список"}));
        expect(onRefresh).toHaveBeenCalledOnce();
        cleanup();
        render(<LiveStatus freshness={{kind: "manual", onRefresh, refreshing: true}} updatedAt={at} />);
        expect((screen.getByRole("button", {name: "Оновити список"}) as HTMLButtonElement).disabled).toBe(true);
    });

    it("describes polling", () => {
        render(<LiveStatus freshness={{kind: "polling", seconds: 30}} updatedAt={at} />);
        expect(screen.getByText("Автооновлення")).toBeTruthy();
        expect(screen.getByRole("tooltip").textContent).toBe("Дані оновлюються автоматично кожні 30 с.");
    });
});
