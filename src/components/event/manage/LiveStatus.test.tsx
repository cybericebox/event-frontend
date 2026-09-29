// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {LiveStatus, shownFreshness} from "./LiveStatus";

afterEach(() => {cleanup(); vi.useRealTimers();});

const at = new Date(2026, 8, 29, 14, 5, 9).getTime();
const stream = (mode: "live" | "connecting" | "fallback", failing = false) => ({kind: "stream" as const, mode, pollSeconds: 30, failing});

describe("status wording", () => {
    it("maps every state to one wording", () => {
        expect(shownFreshness(stream("live"), at, at + 10_000)).toBe("live");
        expect(shownFreshness(stream("live"), at, at + 31_000)).toBe("reconnecting");
        expect(shownFreshness(stream("live"), 0, at)).toBe("reconnecting");
        expect(shownFreshness(stream("connecting"), at, at)).toBe("reconnecting");
        expect(shownFreshness(stream("fallback"), at, at)).toBe("polling");
        expect(shownFreshness(stream("fallback", true), at, at)).toBe("offline");
        expect(shownFreshness({kind: "polling", seconds: 30}, at, at)).toBe("polling");
        expect(shownFreshness({kind: "manual", onRefresh: () => {}, refreshing: false}, at, at)).toBe("manual");
    });
});

describe("live status", () => {
    beforeEach(() => {vi.useFakeTimers(); vi.setSystemTime(at + 1000);});

    it("shows «Наживо» with the last confirmation and says what the time means", () => {
        render(<LiveStatus freshness={stream("live")} updatedAt={at} />);
        expect(screen.getByText("Наживо")).toBeTruthy();
        expect(screen.getByText("Оновлено 14:05:09")).toBeTruthy();
        expect(screen.getByRole("tooltip").textContent).toBe("Нові дані з'являються одразу. «Оновлено» — останнє підтвердження від сервера, що з'єднання живе (щонайменше кожні 15 с).");
    });

    it("never keeps «Наживо» with an old time: after 2× heartbeat it says «Перепідключення…»", () => {
        render(<LiveStatus freshness={stream("live")} updatedAt={at} />);
        expect(screen.getByText("Наживо")).toBeTruthy();
        act(() => {vi.advanceTimersByTime(35_000);});
        expect(screen.queryByText("Наживо")).toBeNull();
        expect(screen.getByText("Перепідключення…")).toBeTruthy();
    });

    it("says «Автооновлення» in the polling fallback and «Не підключено» when polling fails too", () => {
        render(<LiveStatus freshness={stream("fallback")} updatedAt={at} />);
        expect(screen.getByText("Автооновлення")).toBeTruthy();
        expect(screen.getByRole("tooltip").textContent).toBe("Сторінка сама перевіряє нові дані приблизно кожні 30 с. «Оновлено» — час останньої перевірки.");
        cleanup();
        render(<LiveStatus freshness={stream("fallback", true)} updatedAt={at} />);
        expect(screen.getByText("Не підключено")).toBeTruthy();
    });

    it("takes a page's own tooltip text", () => {
        render(<LiveStatus freshness={{kind: "polling", seconds: 30}} updatedAt={at} hint="Рейтинг заморожено о 14:00." />);
        expect(screen.getByText("Автооновлення")).toBeTruthy();
        expect(screen.getByRole("tooltip").textContent).toBe("Рейтинг заморожено о 14:00.");
    });

    it("offers a refresh button when the list does not refresh itself", () => {
        const onRefresh = vi.fn();
        render(<LiveStatus freshness={{kind: "manual", onRefresh, refreshing: false}} updatedAt={at} />);
        expect(screen.queryByText("Наживо")).toBeNull();
        expect(screen.getAllByText("Список не оновлюється сам — натисніть, щоб оновити").length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole("button", {name: "Оновити список"}));
        expect(onRefresh).toHaveBeenCalledOnce();
    });
});
