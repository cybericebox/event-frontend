// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

const pulses = vi.hoisted(() => ({listeners: new Set<(pulse: {Banners: string; Inbox: null}) => void>()}));
vi.mock("@/utils/pulse", () => ({
    subscribePulse: (_event: string, listener: (pulse: {Banners: string; Inbox: null}) => void) => {
        pulses.listeners.add(listener);
        queueMicrotask(() => listener({Banners: "v1", Inbox: null}));
        return () => pulses.listeners.delete(listener);
    },
}));
const emitPulse = (Banners: string) => act(async () => {for (const listener of [...pulses.listeners]) listener({Banners, Inbox: null});});

import {SiteBanner, SiteBannerBar} from "./SiteBanners";

const EVENT_ID = "01a0d498-32b3-7a38-8355-30cc209f56ab";
const banner = (patch: Record<string, unknown> = {}) => ({ID: "b1", Kind: "site", Title: "", Text: "Сервери недоступні до 18:00", LinkURL: "", LinkLabel: "", Level: "info", Dismissible: true, Version: 1, ...patch});
const freezeMessage = "Результати заморожено. Оновлені результати зʼявляться після підбиття підсумків.";
const freezeBanner = (patch: Record<string, unknown> = {}) => banner({ID: `system-results-freeze:${EVENT_ID}`, Kind: "system", Text: freezeMessage, Level: "warning", Dismissible: false, ...patch});

function mockBanners(...responses: unknown[][]) {
    const calls: Array<{url: string; method: string}> = [];
    let index = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({url, method: init?.method ?? "GET"});
        if (url.includes("/dismiss")) return new Response(JSON.stringify({Status: {Code: 0}, Data: null}), {status: 200});
        if (!url.includes("/api/notifications/banners?")) throw new Error(`Unexpected request: ${url}`);
        return new Response(JSON.stringify({Status: {Code: 0}, Data: responses[Math.min(index++, responses.length - 1)]}), {status: 200});
    }) as typeof fetch;
    return calls;
}
const listCalls = (calls: Array<{url: string}>) => calls.filter(call => call.url.includes("/banners?"));

function renderBar() {
    return render(<QueryClientProvider client={new QueryClient()}><SiteBannerBar eventID={EVENT_ID} /></QueryClientProvider>);
}

describe("Банери сайту", () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(() => {cleanup(); pulses.listeners.clear(); vi.useRealTimers(); vi.restoreAllMocks();});

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
        const calls = mockBanners([banner(), banner({ID: "b2", Text: "Попередження", Level: "warning"})]);
        const {container} = renderBar();
        expect(await screen.findByText("Попередження")).toBeTruthy();
        expect(screen.queryByText("Сервери недоступні до 18:00")).toBeNull();
        expect(container.querySelectorAll(".ib-banner")).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", {name: "Ще 1 оголошення"}));
        const others = await screen.findByRole("dialog", {name: "Інші оголошення"});
        expect(within(others).getByText("Сервери недоступні до 18:00")).toBeTruthy();
        expect(calls[0].url).toBe(`https://api.test/api/notifications/banners?site=event&event=${EVENT_ID}`);
    });

    it("bounds ten announcements to one and promotes the next after dismissal", async () => {
        mockBanners(Array.from({length: 10}, (_, index) => banner({ID: `b${index}`, Text: `Оголошення ${index}`})));
        const {container} = renderBar();
        await screen.findByText("Оголошення 0");
        expect(container.querySelectorAll(".ib-banner")).toHaveLength(1);
        expect(screen.queryByText("Оголошення 1")).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Закрити банер"}));
        expect(await screen.findByText("Оголошення 1")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Ще 8 оголошень"}));
        const others = await screen.findByRole("dialog", {name: "Інші оголошення"});
        expect(within(others).getByText("Оголошення 9")).toBeTruthy();
        fireEvent.click(within(others).getAllByRole("button", {name: "Закрити банер"})[0]);
        expect(screen.queryByText("Оголошення 2")).toBeNull();
        expect(screen.getByText("Оголошення 1")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Ще 7 оголошень"})).toBeTruthy();
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

    it("reads the list on the first pulse and again only when the pulse reports a new Banners version", async () => {
        const calls = mockBanners([banner()], [banner({Text: "Нове оголошення", Version: 2})]);
        renderBar();
        await screen.findByText("Сервери недоступні до 18:00");
        await emitPulse("v1");
        await emitPulse("v1");
        expect(listCalls(calls)).toHaveLength(1);
        await emitPulse("v2");
        expect(await screen.findByText("Нове оголошення")).toBeTruthy();
        await emitPulse("v2");
        expect(listCalls(calls)).toHaveLength(2);
    });

    it("never polls by itself", async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        const calls = mockBanners([banner()]);
        renderBar();
        await screen.findByText("Сервери недоступні до 18:00");
        await vi.advanceTimersByTimeAsync(180_000);
        expect(listCalls(calls)).toHaveLength(1);
    });

    it("shows the server's freeze banner without a close button, a stored mark or a freeze request", async () => {
        const calls = mockBanners([freezeBanner()]);
        const {container} = render(<QueryClientProvider client={new QueryClient()}><SiteBannerBar eventID={EVENT_ID} /><main><h1>Правила заходу</h1></main></QueryClientProvider>);
        expect(await screen.findByText(freezeMessage)).toBeTruthy();
        expect(container.querySelector(".ib-banner")?.getAttribute("data-level")).toBe("warning");
        expect(screen.queryByRole("button", {name: "Закрити банер"})).toBeNull();
        expect(window.localStorage.length).toBe(0);
        expect(calls.every(call => call.url.includes("/api/notifications/banners?"))).toBe(true);
    });

    it("sorts critical announcements above the freeze and preserves the order within each level", async () => {
        mockBanners([banner({ID: "i", Text: "Інформація"}), banner({ID: "w1", Text: "Перше попередження", Level: "warning"}),
            banner({ID: "c", Text: "Критичне", Level: "critical"}), banner({ID: "w2", Text: "Друге попередження", Level: "warning"}), freezeBanner()]);
        renderBar();
        expect(await screen.findByText("Критичне")).toBeTruthy();
        fireEvent.click(await screen.findByRole("button", {name: "Ще 4 оголошення"}));
        const others = await screen.findByRole("dialog", {name: "Інші оголошення"});
        expect([...others.querySelectorAll(".ib-banner__msg")].map(item => item.textContent)).toEqual(["Перше попередження", "Друге попередження", freezeMessage, "Інформація"]);
    });

    it("dismisses a personal banner on the server, not in the browser", async () => {
        const calls = mockBanners([banner({ID: "p1", Kind: "personal"})]);
        renderBar();
        fireEvent.click(await screen.findByRole("button", {name: "Закрити банер"}));
        expect(screen.queryByText("Сервери недоступні до 18:00")).toBeNull();
        await waitFor(() => expect(calls.some(call => call.method === "PATCH" && call.url === "https://api.test/api/notifications/banners/p1/dismiss")).toBe(true));
        expect(window.localStorage.length).toBe(0);
    });
});
