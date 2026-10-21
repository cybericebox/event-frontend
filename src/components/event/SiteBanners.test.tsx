// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {focusManager, QueryClient, QueryClientProvider} from "@tanstack/react-query";

vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {SiteBanner, SiteBannerBar} from "./SiteBanners";

const EVENT_ID = "01a0d498-32b3-7a38-8355-30cc209f56ab";
const banner = (patch: Record<string, unknown> = {}) => ({ID: "b1", Text: "Сервери недоступні до 18:00", LinkURL: "", LinkLabel: "", Level: "info", Dismissible: true, Version: 1, ...patch});
const freezeState = (patch: Record<string, unknown> = {}) => ({Enabled: true, FrozenAt: null, FinishAt: null, OpenedAt: null,
    Active: true, Applied: true, BannerText: "", BannerLevel: "warning", ...patch});
const freezeMessage = "Результати заморожено. Оновлені результати зʼявляться після підбиття підсумків.";

function mockEventBanners(responses: unknown[][], freezes: Array<Record<string, unknown> | number>) {
    const urls: string[] = [];
    let index = 0, freezeIndex = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.endsWith("/results/freeze")) {
            const reply = freezes[Math.min(freezeIndex++, freezes.length - 1)];
            return typeof reply === "number" ? new Response("{}", {status: reply}) : new Response(JSON.stringify({Data: reply}));
        }
        if (!url.includes("/api/banners?")) throw new Error(`Unexpected request: ${url}`);
        return new Response(JSON.stringify({Status: {Code: 0}, Data: responses[Math.min(index++, responses.length - 1)]}), {status: 200});
    }) as typeof fetch;
    return urls;
}

function mockBanners(...responses: unknown[][]) {
    return mockEventBanners(responses, [freezeState({Active: false, Applied: false})]);
}

function renderBar() {
    return render(<QueryClientProvider client={new QueryClient()}><SiteBannerBar eventID={EVENT_ID} /></QueryClientProvider>);
}

describe("Банери сайту", () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(() => {cleanup(); focusManager.setFocused(undefined); vi.useRealTimers(); vi.restoreAllMocks();});

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
        expect(await screen.findByText("Попередження")).toBeTruthy();
        expect(screen.queryByText("Сервери недоступні до 18:00")).toBeNull();
        expect(container.querySelectorAll(".ib-banner")).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", {name: "Ще 1 оголошення"}));
        const others = await screen.findByRole("dialog", {name: "Інші оголошення"});
        expect(within(others).getByText("Сервери недоступні до 18:00")).toBeTruthy();
        expect(urls[0]).toBe(`https://api.test/api/banners?site=event&event=${EVENT_ID}`);
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

    it("adds the standard freeze banner on any event page without a results snapshot request or dismissal", async () => {
        const urls = mockEventBanners([[]], [freezeState()]);
        const {container} = render(<QueryClientProvider client={new QueryClient()}><SiteBannerBar eventID={EVENT_ID} /><main><h1>Правила заходу</h1></main></QueryClientProvider>);
        expect(await screen.findByText(freezeMessage)).toBeTruthy();
        expect(screen.getByRole("heading", {name: "Правила заходу"})).toBeTruthy();
        expect(container.querySelector(".ib-banner")?.getAttribute("data-level")).toBe("warning");
        expect(screen.queryByRole("button", {name: "Закрити банер"})).toBeNull();
        expect(window.localStorage.length).toBe(0);
        expect(urls).toContain(`https://api.test/api/events/${EVENT_ID}/results/freeze`);
        expect(urls.every(url => url.includes("/api/banners?") || url.endsWith("/results/freeze"))).toBe(true);
    });

    it("sorts critical announcements above the freeze and preserves ordinary order within each level", async () => {
        mockEventBanners([[banner({ID: "i", Text: "Інформація"}), banner({ID: "w1", Text: "Перше попередження", Level: "warning"}),
            banner({ID: "c", Text: "Критичне", Level: "critical"}), banner({ID: "w2", Text: "Друге попередження", Level: "warning"})]], [freezeState()]);
        renderBar();
        expect(await screen.findByText("Критичне")).toBeTruthy();
        fireEvent.click(await screen.findByRole("button", {name: "Ще 4 оголошення"}));
        const others = await screen.findByRole("dialog", {name: "Інші оголошення"});
        expect([...others.querySelectorAll(".ib-banner__msg")].map(item => item.textContent)).toEqual(["Перше попередження", "Друге попередження", freezeMessage, "Інформація"]);
        const freeze = within(others).getByText(freezeMessage).closest(".ib-banner")!;
        expect(within(freeze as HTMLElement).queryByRole("button", {name: "Закрити банер"})).toBeNull();
    });

    it.each(["info", "warning", "critical"])("uses authored freeze text and the standard %s style", async level => {
        mockEventBanners([[]], [freezeState({BannerText: "До <b>нагородження</b>", BannerLevel: level})]);
        const {container} = renderBar();
        expect(await screen.findByText("До <b>нагородження</b>")).toBeTruthy();
        expect(container.querySelector(".ib-banner")?.getAttribute("data-level")).toBe(level);
        expect(container.querySelector(".ib-banner b")).toBeNull();
        expect(screen.queryByRole("button", {name: "Закрити банер"})).toBeNull();
    });

    it.each([{Active: false, Applied: false}, {Active: true, Applied: false}])("omits the virtual banner when the caller's freeze is not applied: %s", async state => {
        const urls = mockEventBanners([[]], [freezeState(state)]);
        const {container} = renderBar();
        await waitFor(() => expect(urls.some(url => url.endsWith("/results/freeze"))).toBe(true));
        expect(container.querySelector("[data-testid=site-banners]")).toBeNull();
    });

    it.each([401, 403, 404])("removes a cached virtual banner after a %i access denial while keeping ordinary announcements", async status => {
        mockEventBanners([[banner({Text: "Оголошення"})]], [freezeState({BannerLevel: "critical"}), status]);
        renderBar();
        expect(await screen.findByText(freezeMessage)).toBeTruthy();
        await act(async () => {focusManager.setFocused(false); focusManager.setFocused(true);});
        expect(await screen.findByText("Оголошення")).toBeTruthy();
        expect(screen.queryByText(freezeMessage)).toBeNull();
    });

    it("keeps an active freeze through a transient failure but never revives denied cached state before a successful read", async () => {
        const urls = mockEventBanners([[]], [freezeState(), 503, 404, 503, freezeState()]);
        renderBar();
        expect(await screen.findByText(freezeMessage)).toBeTruthy();
        const refocus = async (calls: number) => {
            await act(async () => {focusManager.setFocused(false); focusManager.setFocused(true);});
            await waitFor(() => expect(urls.filter(url => url.endsWith("/results/freeze"))).toHaveLength(calls));
        };
        await refocus(2);
        expect(screen.getByText(freezeMessage)).toBeTruthy();
        await refocus(3);
        await waitFor(() => expect(screen.queryByText(freezeMessage)).toBeNull());
        await refocus(4);
        expect(screen.queryByText(freezeMessage)).toBeNull();
        await refocus(5);
        expect(await screen.findByText(freezeMessage)).toBeTruthy();
    });

    it("revalidates the light state at the freeze start and finish before the minute poll", async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        const now = Date.now();
        const times = {FrozenAt: new Date(now + 2000).toISOString(), FinishAt: new Date(now + 6000).toISOString()};
        const urls = mockEventBanners([[]], [freezeState({...times, Active: false, Applied: false}), freezeState(times), freezeState({...times, Active: false, Applied: false})]);
        renderBar();
        await waitFor(() => expect(urls.some(url => url.endsWith("/results/freeze"))).toBe(true));
        await act(async () => {await vi.advanceTimersByTimeAsync(3100);});
        expect(await screen.findByText(freezeMessage)).toBeTruthy();
        await act(async () => {await vi.advanceTimersByTimeAsync(4100);});
        await waitFor(() => expect(screen.queryByText(freezeMessage)).toBeNull());
        expect(urls.filter(url => url.endsWith("/results/freeze"))).toHaveLength(3);
    });
});
