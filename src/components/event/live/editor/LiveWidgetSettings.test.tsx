// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {defaultLiveLayout, type LiveWidget} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveWidgetSettings, qrProblem} from "./LiveWidgetSettings";
import {liveListFit} from "../liveText";

const api = vi.hoisted(() => ({upload: vi.fn(), settings: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(), uploadLiveLogo: api.upload}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<typeof import("@/api/manageResults")>(), getResultsSettings: api.settings}));

const event = {EventID: "01900000-0000-7000-8000-000000000001", Name: "Захід", StartTime: "2026-09-29T08:00:00Z", FinishTime: "2026-09-29T20:00:00Z", Participation: 1, LogoURL: "", Theme: {Brand: "#211A52"}} as unknown as PublicEventInfo;

function mount(widget: LiveWidget, onProp = vi.fn()) {
    api.settings.mockResolvedValue({FreezeEnabled: false, Freeze: {FrozenAt: null}});
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const layout = {...defaultLiveLayout, widgets: [widget]};
    render(<QueryClientProvider client={client}><LiveWidgetSettings event={event} layout={layout} widget={widget} disabled={false} onPlace={vi.fn()} onProp={onProp} onDistribute={vi.fn()} onRemove={vi.fn()} /></QueryClientProvider>);
    return onProp;
}
afterEach(cleanup);

describe("live widget settings", () => {
    it("groups settings under «Відображення» and «Розташування й розмір» with the remove icon in the header", () => {
        mount({id: "c", type: "chart", x: 1, y: 2, w: 8, h: 6, props: {}});
        expect(screen.getByText("Відображення")).toBeTruthy();
        expect(screen.getByText("Розташування й розмір")).toBeTruthy();
        expect(screen.getByText("Кількість команд на графіку")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Прибрати віджет"}).closest("header")).not.toBeNull();
        expect(screen.getAllByRole("button", {name: /^Про поле|Довідка|про поле/i}).length).toBeGreaterThan(0);
    });

    it("warns when the rows would be unreadable and recommends a page time", () => {
        const widget: LiveWidget = {id: "t", type: "table", x: 9, y: 2, w: 4, h: 6, props: {rowsPerPage: 40, pageSeconds: 5}};
        const max = liveListFit({...defaultLiveLayout, widgets: [widget]}, widget).maxRows;
        mount(widget);
        expect(screen.getByText(`Забагато рядків: текст стане задрібним. Для цього розміру — не більше ${max}.`)).toBeTruthy();
        expect(screen.getByText(/Рекомендовано не менше ~\d+ с для 40 рядків/)).toBeTruthy();
        expect(screen.getByText(/Замало, щоб прочитати сторінку/)).toBeTruthy();
    });

    it("asks for the date of a custom timer", () => {
        mount({id: "tm", type: "timer", x: 11, y: 1, w: 2, h: 1, props: {source: "custom"}});
        expect(screen.getByText("Дата й час")).toBeTruthy();
        expect(screen.getByText("Оберіть дату й час.")).toBeTruthy();
        expect(screen.getByPlaceholderText("Залишилось")).toBeTruthy();
    });

    it("uploads logos as files only and stores them as items", async () => {
        api.upload.mockResolvedValue("/api/events/e/content-images/new");
        const onProp = mount({id: "l", type: "logos", x: 1, y: 8, w: 3, h: 1, props: {mode: "fixed", items: [{src: "/api/events/e/content-images/a"}]}});
        expect(screen.queryByRole("textbox", {name: /https/})).toBeNull();
        const input = document.querySelector(".event-file-picker__input") as HTMLInputElement;
        const file = new File(["<svg/>"], "logo.svg", {type: "image/svg+xml"});
        await act(async () => {fireEvent.change(input, {target: {files: [file]}});});
        expect(api.upload).toHaveBeenCalledWith(event.EventID, file);
        expect(onProp).toHaveBeenCalledWith("items", [{src: "/api/events/e/content-images/a"}, {src: "/api/events/e/content-images/new"}]);
    });
});

describe("QR content", () => {
    it("accepts links, site paths and text, and flags broken links", () => {
        expect(qrProblem("https://ctf.example/register")).toBeNull();
        expect(qrProblem("/register")).toBeNull();
        expect(qrProblem("Wi-Fi: ctf / пароль 1234")).toBeNull();
        expect(qrProblem("")).toBe("Вкажіть, що закодувати.");
        expect(qrProblem("https://nohost")).toBe("Це схоже на посилання, але воно неправильне.");
        expect(qrProblem("www.ctf.example")).toBe("Додайте https:// на початку.");
    });
});
