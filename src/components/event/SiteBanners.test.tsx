// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {SiteBanner, SiteBannerBar} from "./SiteBanners";

const EVENT_ID = "01a0d498-32b3-7a38-8355-30cc209f56ab";
const banner = (patch: Record<string, unknown> = {}) => ({ID: "b1", Text: "Сервери недоступні до 18:00", LinkURL: "", LinkLabel: "", Level: "info", Dismissible: true, Version: 1, ...patch});

function mockBanners(...responses: unknown[][]) {
    const urls: string[] = [];
    let index = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return new Response(JSON.stringify({Status: {Code: 0}, Data: responses[Math.min(index++, responses.length - 1)]}), {status: 200});
    }) as typeof fetch;
    return urls;
}

function renderBar() {
    return render(<QueryClientProvider client={new QueryClient()}><SiteBannerBar eventID={EVENT_ID} /></QueryClientProvider>);
}

describe("Банери сайту", () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(() => {cleanup(); vi.restoreAllMocks();});

    it("draws a level as a calm tinted row with a link and no close button when it cannot be dismissed", () => {
        const {container} = render(<SiteBanner banner={{Text: "Важливо", LinkURL: "https://example.com/a", LinkLabel: "Деталі", Level: "critical", Dismissible: false}} onDismiss={() => undefined} />);
        expect(container.querySelector(".ib-banner--danger")).not.toBeNull();
        expect(screen.getByRole("alert").textContent).toContain("Важливо");
        const link = screen.getByRole("link", {name: /Деталі/});
        expect(link.getAttribute("href")).toBe("https://example.com/a");
        expect(link.getAttribute("rel")).toContain("noopener");
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("drops a link that is not a site path or an http(s) address", () => {
        render(<SiteBanner banner={{Text: "Текст", LinkURL: "javascript:alert(1)", LinkLabel: "Клік", Level: "info", Dismissible: false}} />);
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("asks the event's banners and shows them", async () => {
        const urls = mockBanners([banner(), banner({ID: "b2", Text: "Попередження", Level: "warning"})]);
        const {container} = renderBar();
        expect(await screen.findByText("Сервери недоступні до 18:00")).toBeTruthy();
        expect(screen.getByText("Попередження")).toBeTruthy();
        expect(container.querySelector(".ib-banner--warning")).not.toBeNull();
        expect(urls[0]).toBe(`https://api.test/api/banners?event=${EVENT_ID}`);
    });

    it("renders nothing without banners or when the request fails", async () => {
        mockBanners([]);
        const {container} = renderBar();
        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
        expect(container.querySelector("[data-testid=site-banners]")).toBeNull();
        cleanup();
        globalThis.fetch = vi.fn(async () => new Response("{}", {status: 500})) as typeof fetch;
        const failed = renderBar();
        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
        expect(failed.container.textContent).toBe("");
    });

    it("hides a dismissed banner and remembers it by id and version", async () => {
        mockBanners([banner()]);
        renderBar();
        fireEvent.click(await screen.findByRole("button", {name: "Закрити банер"}));
        expect(screen.queryByText("Сервери недоступні до 18:00")).toBeNull();
        expect(window.localStorage.getItem("cib_site_banner_dismissed_b1_1")).toBe("1");
        cleanup();
        mockBanners([banner()]);
        renderBar();
        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
        expect(screen.queryByText("Сервери недоступні до 18:00")).toBeNull();
    });

    it("shows an edited banner again: a new version is not dismissed", async () => {
        window.localStorage.setItem("cib_site_banner_dismissed_b1_1", "1");
        mockBanners([banner({Version: 2, Text: "Оновлений текст"})]);
        renderBar();
        expect(await screen.findByText("Оновлений текст")).toBeTruthy();
    });

    it("never hides a banner that cannot be dismissed, even with a stored mark", async () => {
        window.localStorage.setItem("cib_site_banner_dismissed_b1_1", "1");
        mockBanners([banner({Dismissible: false})]);
        renderBar();
        expect(await screen.findByText("Сервери недоступні до 18:00")).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Закрити банер"})).toBeNull();
    });

    it("keeps working when the storage is unavailable", async () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {throw new Error("blocked");});
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {throw new Error("blocked");});
        mockBanners([banner()]);
        renderBar();
        fireEvent.click(await screen.findByRole("button", {name: "Закрити банер"}));
        expect(screen.queryByText("Сервери недоступні до 18:00")).toBeNull();
    });

    it("polls about every minute", async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        try {
            const urls = mockBanners([banner()]);
            renderBar();
            await screen.findByText("Сервери недоступні до 18:00");
            const before = urls.length;
            await vi.advanceTimersByTimeAsync(60_500);
            expect(urls.length).toBeGreaterThan(before);
        } finally {vi.useRealTimers();}
    });
});
