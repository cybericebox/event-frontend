// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {defaultLiveLayout, type LiveEditor as LiveEditorData} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveEditor} from "./LiveEditor";

// jsdom has no top-layer dialog.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const api = vi.hoisted(() => ({save: vi.fn(), publish: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(), saveManageLiveDraft: api.save, publishManageLive: api.publish}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<typeof import("@/api/manageResults")>(),
    getResultsSettings: vi.fn(() => new Promise(() => undefined))}));
vi.mock("../useLiveResults", () => ({useLiveResults: () => ({results: {data: undefined}, stream: "live"})}));
vi.mock("../LiveQR", () => ({LiveQR: () => null}));

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Tag: "test", Name: "Кібер-захід",
    StartTime: "2026-09-28T00:00:00Z", FinishTime: null, Status: 2,
    Participation: 1, Registration: 1, CanViewResults: false, CanViewParticipants: false, LiveAudience: "staff",
    PreviewDescription: "", PreviewPicture: "", LogoURL: "", FaviconURL: "",
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} as unknown as PublicEventInfo;
const data: LiveEditorData = {Published: defaultLiveLayout, Draft: null};

function mount(canManage = true) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><LiveEditor event={event} canManage={canManage} data={data} /></QueryClientProvider>);
}
const widgets = () => document.querySelectorAll(".event-live-editor__native .live-widget").length;

beforeEach(() => {api.save.mockReset().mockResolvedValue(undefined); api.publish.mockReset();});
afterEach(cleanup);

describe("live editor", () => {
    it("shows the published state and keeps publish off without changes", () => {
        mount();
        expect(document.querySelector(".event-live-editor__status")!.textContent).toContain("Опубліковано");
        expect((screen.getByRole("button", {name: /Опублікувати/}) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.queryByRole("button", {name: /Зберегти чернетку/})).toBeNull();
    });

    it("renders every palette widget as a preview with sample data", () => {
        mount();
        const items = document.querySelectorAll(".event-live-palette-item");
        expect(items.length).toBe(9);
        items.forEach(item => expect(item.querySelector(".live-canvas")).not.toBeNull());
        expect(screen.getByText(/зразок даних/)).toBeTruthy();
        expect(document.querySelector(".event-live-editor__native .live-table tbody tr")).not.toBeNull();
    });

    it("adds a widget from the palette, then undoes and redoes it", () => {
        mount();
        const before = widgets();
        fireEvent.click(screen.getByRole("button", {name: "Додати віджет «Оголошення»"}));
        expect(widgets()).toBe(before + 1);
        fireEvent.keyDown(window, {key: "z", metaKey: true});
        expect(widgets()).toBe(before);
        fireEvent.keyDown(window, {key: "z", metaKey: true, shiftKey: true});
        expect(widgets()).toBe(before + 1);
    });

    it("moves the selected widget with the arrows and asks before removing it", () => {
        mount();
        fireEvent.click(screen.getByRole("button", {name: "Додати віджет «QR-код»"}));
        const qr = () => document.querySelector(".event-live-editor__native .live-widget--qr") as HTMLElement;
        const column = qr().style.gridColumn;
        fireEvent.keyDown(window, {key: "ArrowRight"});
        expect(qr().style.gridColumn).not.toBe(column);
        fireEvent.keyDown(window, {key: "Delete"});
        expect(screen.getByText("Прибрати віджет?")).toBeTruthy();
        // Arrows do nothing while the confirmation is open.
        const moved = qr().style.gridColumn;
        fireEvent.keyDown(window, {key: "ArrowRight"});
        expect(qr().style.gridColumn).toBe(moved);
    });

    it("saves the draft by itself and shows the unpublished state", async () => {
        vi.useFakeTimers();
        try {
            mount();
            fireEvent.click(screen.getByRole("radio", {name: /Класика світла/}));
            await act(async () => {vi.advanceTimersByTime(1000);});
            expect(api.save).toHaveBeenCalledTimes(1);
            expect(api.save.mock.calls[0][1].theme).toBe("light");
            expect(document.querySelector(".event-live-editor__status")!.textContent).toContain("не опубліковано");
            expect((screen.getByRole("button", {name: /Опублікувати/}) as HTMLButtonElement).disabled).toBe(false);
        } finally {vi.useRealTimers();}
    });

    it("previews other screen shapes automatically and lets a shape get its own layout", () => {
        mount();
        fireEvent.click(screen.getByRole("tab", {name: "4:3"}));
        expect(screen.getAllByText(/1440×1080/).length).toBeGreaterThan(0);
        expect(screen.getByText(/будується автоматично з основного/)).toBeTruthy();
        expect((screen.getByRole("button", {name: "Додати віджет «Таймер»"}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole("button", {name: "Власна розкладка"}));
        expect(screen.getByRole("tab", {name: "4:3 · власна"})).toBeTruthy();
        expect(screen.queryByText(/будується автоматично з основного/)).toBeNull();
        expect(document.querySelector(".event-live-editor__error")).toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: "16:9 · основний"}));
        expect(screen.getAllByText(/1920×1080/).length).toBeGreaterThan(0);
    });

    it("applies a layout template from the dialog and marks later edits", () => {
        mount();
        fireEvent.click(screen.getByRole("button", {name: /Застосувати шаблон/}));
        const cards = within(screen.getByRole("radiogroup", {name: "Шаблон розкладки"})).getAllByRole("radio");
        expect(cards).toHaveLength(5);
        cards.forEach(card => expect(card.querySelector(".live-canvas")).not.toBeNull());
        expect(screen.getByText(/буде замінено/)).toBeTruthy();
        const apply = screen.getByRole("button", {name: "Застосувати"}) as HTMLButtonElement;
        expect(apply.disabled).toBe(true);
        fireEvent.click(screen.getByRole("radio", {name: /Лише таблиця/}));
        expect(screen.getByRole("radio", {name: /Лише таблиця/}).getAttribute("aria-checked")).toBe("true");
        fireEvent.click(apply);
        expect(screen.getByText("Шаблон: Лише таблиця")).toBeTruthy();
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Додати віджет «Оголошення»"}));
        expect(screen.getByText("Шаблон: Лише таблиця · змінено")).toBeTruthy();
    });

    it("is read-only for viewers", () => {
        mount(false);
        expect(screen.queryByRole("button", {name: /Опублікувати/})).toBeNull();
        expect((screen.getByRole("button", {name: "Додати віджет «Таймер»"}) as HTMLButtonElement).disabled).toBe(true);
    });
});
