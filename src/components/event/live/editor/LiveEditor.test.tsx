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

const api = vi.hoisted(() => ({save: vi.fn(), publish: vi.fn(), settings: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(), saveManageLiveDraft: api.save, publishManageLive: api.publish}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<typeof import("@/api/manageResults")>(),
    getResultsSettings: api.settings}));
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
// The default layout fills its grid; without the partners row there is room.
const roomy: LiveEditorData = {Published: {...defaultLiveLayout, widgets: defaultLiveLayout.widgets.filter(item => item.id !== "partners")}, Draft: null};

function mount(canManage = true, editor = data) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><LiveEditor event={event} canManage={canManage} data={editor} /></QueryClientProvider>);
}
const widgets = () => document.querySelectorAll(".event-live-editor__native .live-widget").length;

beforeEach(() => {api.save.mockReset().mockResolvedValue(undefined); api.publish.mockReset(); api.settings.mockReset().mockReturnValue(new Promise(() => undefined));});
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
        expect(items.length).toBe(14);
        items.forEach(item => expect(item.querySelector(".live-canvas")).not.toBeNull());
        expect(screen.getByText(/зразок даних/)).toBeTruthy();
        expect(document.querySelector(".event-live-editor__native .live-table tbody tr")).not.toBeNull();
    });

    it("adds a widget from the palette, then undoes and redoes it", () => {
        mount(true, roomy);
        const before = widgets();
        fireEvent.click(screen.getByRole("button", {name: "Додати віджет «Оголошення»"}));
        expect(widgets()).toBe(before + 1);
        fireEvent.keyDown(window, {key: "z", metaKey: true});
        expect(widgets()).toBe(before);
        fireEvent.keyDown(window, {key: "z", metaKey: true, shiftKey: true});
        expect(widgets()).toBe(before + 1);
    });

    it("never grows the grid by itself: a full grid says there is no room", () => {
        mount();
        const before = widgets();
        fireEvent.click(screen.getByRole("button", {name: "Додати віджет «Оголошення»"}));
        expect(widgets()).toBe(before);
        expect(screen.getByText("Немає вільного місця: звільніть клітинки або збільште сітку.")).toBeTruthy();
        expect(document.querySelector(".event-live-editor__native .live-canvas")!.getAttribute("style")).toContain("--live-rows: 8");
    });

    it("moves the selected widget with the arrows and asks before removing it", () => {
        mount(true, roomy);
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

    it("applies a layout template to the scene being edited and marks later edits", () => {
        mount();
        fireEvent.click(screen.getByRole("button", {name: /Застосувати шаблон/}));
        const cards = within(screen.getByRole("radiogroup", {name: "Шаблони екрана"})).getAllByRole("radio");
        expect(cards).toHaveLength(9);
        cards.forEach(card => expect(card.querySelector(".live-canvas")).not.toBeNull());
        const apply = screen.getByRole("button", {name: "Застосувати до «Триває»"}) as HTMLButtonElement;
        expect(apply.disabled).toBe(true);
        fireEvent.click(screen.getByRole("radio", {name: /Велике табло/}));
        expect(screen.getByRole("radio", {name: /Велике табло/}).getAttribute("aria-checked")).toBe("true");
        expect(screen.getByText(/Віджети сцени «Триває» буде замінено/)).toBeTruthy();
        fireEvent.click(apply);
        expect(screen.getByText("Шаблон: Велике табло")).toBeTruthy();
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).toBeNull();
        expect(document.querySelectorAll(".event-live-editor__native .live-table-columns > .live-table")).toHaveLength(2);
        fireEvent.click(screen.getByRole("radio", {name: /Класика світла/}));
        expect(screen.getByText("Шаблон: Велике табло · змінено")).toBeTruthy();
    });

    it("applies «Повний показ» to every scene", () => {
        mount();
        fireEvent.click(screen.getByRole("button", {name: /Застосувати шаблон/}));
        fireEvent.click(screen.getByRole("radio", {name: /Повний показ/}));
        expect(screen.getByText(/Буде замінено всі сцени/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Застосувати до всіх сцен"}));
        expect(document.querySelector(".event-live-editor__native .live-widget--solves")).not.toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: /До старту/}));
        expect(document.querySelector(".event-live-editor__native .live-widget--facts")).not.toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: /Завершено/}));
        expect(document.querySelector(".event-live-editor__native .live-widget--podium")).not.toBeNull();
        // The frozen state shows the running board.
        fireEvent.click(screen.getByRole("tab", {name: /Заморожено/}));
        expect(screen.getByText("Сцена «Заморожено» показує розкладку «Триває».")).toBeTruthy();
        expect(document.querySelector(".event-live-editor__native .live-widget--solves")).not.toBeNull();
    });

    it("edits a scene apart from the running board, and a scene can fall back to it", () => {
        mount();
        fireEvent.click(screen.getByRole("tab", {name: /Заморожено/}));
        expect((screen.getByRole("button", {name: "Додати віджет «Таймер»"}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole("button", {name: "Своя розкладка"}));
        // A copy of the running board, now editable on its own.
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).not.toBeNull();
        fireEvent.click(document.querySelector(".event-live-editor__native .live-widget--chart")!);
        fireEvent.click(screen.getByRole("button", {name: "Прибрати віджет"}));
        fireEvent.click(within(screen.getByText("Прибрати віджет?").closest("dialog, [role=alertdialog], [role=dialog]") as HTMLElement).getByRole("button", {name: "Прибрати віджет"}));
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: /Триває/}));
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).not.toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: /Заморожено/}));
        // Dropping an own layout asks first; «Скасувати» keeps it.
        fireEvent.click(screen.getByRole("button", {name: "Як «Триває»"}));
        const dialog = () => screen.getByText("Скинути розкладку сцени?").closest("dialog, [role=alertdialog], [role=dialog]") as HTMLElement;
        expect(within(dialog()).getByText(/Віджети сцени «Заморожено» буде видалено/)).toBeTruthy();
        fireEvent.click(within(dialog()).getByRole("button", {name: "Скасувати"}));
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).toBeNull();
        expect(screen.getByRole("tab", {name: /Заморожено/}).textContent).toContain("своя");
        fireEvent.click(screen.getByRole("button", {name: "Як «Триває»"}));
        fireEvent.click(within(dialog()).getByRole("button", {name: "Скинути"}));
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).not.toBeNull();
        expect(screen.getByRole("tab", {name: /Заморожено/}).textContent).toContain("як «Триває»");
    });

    it("drops an empty own scene back without asking", () => {
        mount();
        fireEvent.click(screen.getByRole("tab", {name: /Заморожено/}));
        fireEvent.click(screen.getByRole("button", {name: "Своя розкладка"}));
        fireEvent.click(screen.getByRole("button", {name: /Застосувати шаблон/}));
        fireEvent.click(screen.getByRole("radio", {name: /Порожня сітка/}));
        fireEvent.click(screen.getByRole("button", {name: "Застосувати до «Заморожено»"}));
        fireEvent.click(screen.getByRole("button", {name: "Як «Триває»"}));
        expect(screen.queryByText("Скинути розкладку сцени?")).toBeNull();
        expect(screen.getByRole("tab", {name: /Заморожено/}).textContent).toContain("як «Триває»");
    });

    it("opens the scene of the step it undoes and redoes", () => {
        mount();
        fireEvent.click(screen.getByRole("tab", {name: /Завершено/}));
        fireEvent.click(document.querySelector(".event-live-editor__native .live-widget--podium")!);
        fireEvent.keyDown(window, {key: "Delete"});
        fireEvent.click(within(screen.getByText("Прибрати віджет?").closest("dialog, [role=alertdialog], [role=dialog]") as HTMLElement).getByRole("button", {name: "Прибрати віджет"}));
        expect(document.querySelector(".event-live-editor__native .live-widget--podium")).toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: /^Триває/}));
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).not.toBeNull();
        fireEvent.keyDown(window, {key: "z", ctrlKey: true});
        expect(screen.getByRole("tab", {name: /Завершено/}).getAttribute("aria-selected")).toBe("true");
        expect(document.querySelector(".event-live-editor__native .live-widget--podium")).not.toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: /^Триває/}));
        fireEvent.keyDown(window, {key: "y", ctrlKey: true});
        expect(screen.getByRole("tab", {name: /Завершено/}).getAttribute("aria-selected")).toBe("true");
        expect(document.querySelector(".event-live-editor__native .live-widget--podium")).toBeNull();
    });

    it("previews the screen at a target resolution without changing the layout", async () => {
        mount();
        expect(screen.getByText(/^1920×1080 · проєктор/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "720p"}));
        expect(screen.getByText(/^1280×720 · проєктор/)).toBeTruthy();
        const native = document.querySelector(".event-live-editor__native") as HTMLElement;
        expect(native.style.width).toBe("1280px");
        fireEvent.click(screen.getByRole("button", {name: "LED"}));
        expect(screen.getByText(/^1040×624 · LED/)).toBeTruthy();
        // Only the preview changed: nothing to save or publish.
        await act(async () => {await new Promise(resolve => setTimeout(resolve, 900));});
        expect(api.save).not.toHaveBeenCalled();
    });

    it("is read-only for viewers", () => {
        mount(false);
        expect(screen.queryByRole("button", {name: /Опублікувати/})).toBeNull();
        expect((screen.getByRole("button", {name: "Додати віджет «Таймер»"}) as HTMLButtonElement).disabled).toBe(true);
    });

    it("stops at 48 widgets on a scene with a clear message instead of a failing save", () => {
        const full = Array.from({length: 48}, (_, index) => ({id: `q${index}`, type: "qr" as const, x: index % 12 + 1, y: Math.floor(index / 12) + 1, w: 1, h: 1, props: {value: "/"}}));
        mount(true, {Published: {...defaultLiveLayout, scenes: undefined, widgets: full}, Draft: null});
        fireEvent.click(screen.getByRole("button", {name: "Додати віджет «QR-код»"}));
        expect(screen.getByRole("alert").textContent).toBe("На одній сцені може бути не більше 48 віджетів. Приберіть зайвий віджет.");
        expect(document.querySelectorAll(".event-live-editor__native .live-widget")).toHaveLength(48);
    });

    it("says on the «Заморожено» tab that the scene will not show while the freeze is not applied", async () => {
        api.settings.mockResolvedValue({ScoreboardVisibility: 0, FreezeEnabled: true, FreezeMinutes: 60, LiveFreeze: false, ChartEnabled: true, ChartTeams: 10, RowsLimit: null, OpenedAt: null,
            Freeze: {Enabled: true, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false}});
        mount();
        fireEvent.click(screen.getByRole("tab", {name: /Заморожено/}));
        expect(await screen.findByText(/вимкнено: зал бачить живі результати, і ця сцена не покажеться/)).toBeTruthy();
        fireEvent.click(screen.getByRole("tab", {name: /Завершено/}));
        expect(screen.queryByText(/зал бачить живі результати/)).toBeNull();
    });
});
