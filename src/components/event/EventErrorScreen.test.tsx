// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {trackApiFetch} from "@/utils/serviceStatus";
import {EventErrorScreen} from "./EventErrorScreen";

vi.mock("next/navigation", () => ({usePathname: () => "/"}));

afterEach(() => {cleanup(); vi.unstubAllGlobals(); vi.useRealTimers();});

async function api5xx(requestId: string | null) {
    const headers = requestId ? {"X-Request-ID": requestId} : undefined;
    await trackApiFetch(() => Promise.resolve(new Response("", {status: 500, headers})), "https://api.test")("https://api.test/api/x");
}

describe("EventErrorScreen 500", () => {
    it("API error: reported text, reference {code}-{rid8} with copy, report link with the reference", async () => {
        await api5xx("a1b2c3d4-0000-4000-8000-000000000000");
        render(<EventErrorScreen onRetry={() => {}} error={{status: 500, code: 50310}} />);
        expect(screen.getByText("Ми вже отримали звіт про цю помилку. Оновіть сторінку або поверніться назад.")).toBeTruthy();
        expect(screen.getByText(/Номер звернення: 50310-a1b2c3d4/)).toBeTruthy();
        expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
        const write = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", {clipboard: {writeText: write}});
        fireEvent.click(screen.getByRole("button", {name: "Скопіювати номер звернення"}));
        await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe("Скопійовано"));
        expect(write).toHaveBeenCalledWith("50310-a1b2c3d4");
        const link = screen.getByRole("link", {name: "Повідомити деталі"});
        fireEvent.click(link);
        const href = decodeURIComponent(link.getAttribute("href")!);
        expect(href).toContain("subject=Помилка 50310-a1b2c3d4");
        expect(href).toContain("Номер звернення: 50310-a1b2c3d4");
        expect(href).toContain("Що ви робили?");
    });

    it("API error without an exposed request id falls back to the code only", async () => {
        // the previous test's request id has expired by then
        vi.useFakeTimers({toFake: ["Date"]});
        vi.setSystemTime(Date.now() + 10 * 60_000);
        await api5xx(null);
        render(<EventErrorScreen onRetry={() => {}} error={{status: 500, code: 50310}} />);
        expect(screen.queryByText(/Номер звернення/)).toBeNull();
        expect(screen.getByText("Код помилки: 50310")).toBeTruthy();
    });

    it("without a platform code (none or 0) the reference is the 8 request id characters alone", () => {
        for (const code of [undefined, 0]) {
            render(<EventErrorScreen onRetry={() => {}} error={{status: 500, code, requestId: "a1b2c3d4-0000-4000-8000-000000000000"}} />);
            expect(screen.getByText(/Номер звернення: a1b2c3d4$/)).toBeTruthy();
            expect(screen.queryByText(/0-a1b2c3d4/)).toBeNull();
            cleanup();
        }
    });

    it("frontend crash: no report line, no reference, details link carries the trimmed message", () => {
        render(<EventErrorScreen onRetry={() => {}} error={new Error("x".repeat(300))} />);
        expect(screen.getByText("Сталася непередбачена помилка. Оновіть сторінку або поверніться назад.")).toBeTruthy();
        expect(screen.queryByText(/Ми вже отримали звіт/)).toBeNull();
        expect(screen.queryByText(/Номер звернення/)).toBeNull();
        const link = screen.getByRole("link", {name: "Повідомити деталі"});
        fireEvent.click(link);
        const body = decodeURIComponent(link.getAttribute("href")!.split("body=")[1]);
        expect(body).toContain("x".repeat(200));
        expect(body).not.toContain("x".repeat(201));
    });
});

describe("EventErrorScreen caller text", () => {
    it("a backend 5xx shows the reported text over the caller body; a non-API failure keeps the caller body", () => {
        const {unmount} = render(<EventErrorScreen onRetry={() => {}} body="Перевірте зʼєднання та спробуйте ще раз." error={{status: 503, code: 50310}} />);
        expect(screen.getByText("Ми вже отримали звіт про цю помилку. Оновіть сторінку або поверніться назад.")).toBeTruthy();
        expect(screen.queryByText("Перевірте зʼєднання та спробуйте ще раз.")).toBeNull();
        expect(screen.getByRole("heading", {name: "Не вдалося завантажити сторінку"})).toBeTruthy();
        unmount();
        render(<EventErrorScreen onRetry={() => {}} body="Перевірте зʼєднання та спробуйте ще раз." error={new TypeError("fetch failed")} />);
        expect(screen.getByText("Перевірте зʼєднання та спробуйте ще раз.")).toBeTruthy();
    });
});
