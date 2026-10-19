// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {defaultLiveLayout, type LiveEditor as LiveEditorData} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveEditor} from "./LiveEditor";
import {applyLiveTemplate} from "../liveTemplates";
import {withLiveSceneMode} from "../liveScenes";

// jsdom has no top-layer dialog.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const api = vi.hoisted(() => ({save: vi.fn(), publish: vi.fn(), settings: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(), saveManageLiveDraft: api.save, publishManageLive: api.publish}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<typeof import("@/api/manageResults")>(),
    getResultsSettings: api.settings}));
vi.mock("../useLiveResults", () => ({useLiveResults: () => ({results: {data: undefined}, stream: "live"})}));
vi.mock("../LiveQR", () => ({LiveQR: () => null}));
// A plain <select> stands in for the Radix menu, which jsdom cannot open.
vi.mock("@/components/ui/EventSelect", () => ({EventSelect: ({ariaLabel, value, options, onValueChange, disabled}: {ariaLabel: string; value: string; options: {value: string; label: string; disabled?: boolean}[]; onValueChange: (value: string) => void; disabled?: boolean}) =>
    <select aria-label={ariaLabel} value={value} disabled={disabled} onChange={change => onValueChange(change.target.value)}><option value="" />{options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select>}));

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Tag: "test", Name: "Кібер-захід",
    StartTime: "2026-09-28T00:00:00Z", FinishTime: null, Status: 2,
    Participation: 1, Registration: 1, CanViewResults: false, CanViewParticipants: false, LiveAudience: "staff",
    PreviewDescription: "", PreviewPicture: "", LogoURL: "", FaviconURL: "",
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} as unknown as PublicEventInfo;
const data: LiveEditorData = {Published: defaultLiveLayout, Draft: null};
// Separate screens per event state: the board, a pre-start screen and the finale.
const separate: LiveEditorData = {Published: applyLiveTemplate(applyLiveTemplate(withLiveSceneMode(defaultLiveLayout, "separate"), "prestart", "before"), "finale", "finished"), Draft: null};
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
        fireEvent.click(screen.getByRole("button", {name: "Додати блок «Оголошення»"}));
        expect(widgets()).toBe(before + 1);
        fireEvent.keyDown(window, {key: "z", metaKey: true});
        expect(widgets()).toBe(before);
        fireEvent.keyDown(window, {key: "z", metaKey: true, shiftKey: true});
        expect(widgets()).toBe(before + 1);
    });

    it("never grows the grid by itself: a full grid says there is no room", () => {
        mount();
        const before = widgets();
        fireEvent.click(screen.getByRole("button", {name: "Додати блок «Оголошення»"}));
        expect(widgets()).toBe(before);
        expect(screen.getByText("Немає вільного місця: звільніть клітинки або збільште сітку.")).toBeTruthy();
        expect(document.querySelector(".event-live-editor__native .live-canvas")!.getAttribute("style")).toContain("--live-rows: 8");
    });

    it("moves the selected widget with the arrows and asks before removing it", () => {
        mount(true, roomy);
        fireEvent.click(screen.getByRole("button", {name: "Додати блок «QR-код»"}));
        const qr = () => document.querySelector(".event-live-editor__native .live-widget--qr") as HTMLElement;
        const column = qr().style.gridColumn;
        fireEvent.keyDown(window, {key: "ArrowRight"});
        expect(qr().style.gridColumn).not.toBe(column);
        fireEvent.keyDown(window, {key: "Delete"});
        expect(screen.getByText("Прибрати блок?")).toBeTruthy();
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
        expect((screen.getByRole("button", {name: "Додати блок «Таймер»"}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole("button", {name: "Власне розміщення"}));
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
        const apply = screen.getByRole("button", {name: "Застосувати до екрана"}) as HTMLButtonElement;
        expect(apply.disabled).toBe(true);
        fireEvent.click(screen.getByRole("radio", {name: /Велике табло/}));
        expect(screen.getByRole("radio", {name: /Велике табло/}).getAttribute("aria-checked")).toBe("true");
        expect(screen.getByText(/Блоки екрана буде замінено/)).toBeTruthy();
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
        expect(screen.getByText(/екрани всіх станів буде замінено/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Увімкнути окремі екрани й застосувати"}));
        expect(document.querySelector(".event-live-editor__native .live-widget--solves")).not.toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: /До старту/}));
        expect(document.querySelector(".event-live-editor__native .live-widget--facts")).not.toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: /Завершено/}));
        expect(document.querySelector(".event-live-editor__native .live-widget--podium")).not.toBeNull();
        // «Заморожено» gets its own copy of the board.
        fireEvent.click(screen.getByRole("tab", {name: /Заморожено/}));
        expect(document.querySelector(".event-live-editor__native .live-widget--solves")).not.toBeNull();
    });

    it("edits every scene on its own; the tabs mark only the live scene", () => {
        mount(true, separate);
        const tabs = screen.getAllByRole("tab").filter(tab => tab.closest(".event-live-scenes"));
        expect(tabs.map(tab => tab.textContent)).not.toContain("основна");
        expect(tabs.filter(tab => tab.textContent?.includes("зараз"))).toHaveLength(1);
        fireEvent.click(screen.getByRole("tab", {name: /Заморожено/}));
        // Its own copy of the board, editable at once.
        expect((screen.getByRole("button", {name: "Додати блок «Таймер»"}) as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(document.querySelector(".event-live-editor__native .live-widget--chart")!);
        fireEvent.click(screen.getByRole("button", {name: "Прибрати блок"}));
        fireEvent.click(within(screen.getByText("Прибрати блок?").closest("dialog, [role=alertdialog], [role=dialog]") as HTMLElement).getByRole("button", {name: "Прибрати блок"}));
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: /Триває/}));
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).not.toBeNull();
    });

    it("resizes a block from each corner, the opposite corner fixed, and with Shift+arrows", () => {
        HTMLElement.prototype.setPointerCapture ??= () => undefined;
        mount();
        const native = () => document.querySelector(".event-live-editor__native .live-canvas") as HTMLElement;
        // 12×8 cells of 100×100 px.
        native().getBoundingClientRect = () => ({x: 0, y: 0, left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800, toJSON: () => ({})});
        const chart = () => document.querySelector(".event-live-editor__native .live-widget--chart") as HTMLElement;
        const area = () => [chart().style.gridColumn, chart().style.gridRow];
        // The default chart: columns 1–8, rows 2–7.
        expect(area()).toEqual(["1 / span 8", "2 / span 6"]);
        const drag = (corner: string, dx: number, dy: number) => {
            const handle = chart().querySelector(`[data-corner="${corner}"]`) as HTMLElement;
            fireEvent.pointerDown(handle, {button: 0, pointerId: 1, clientX: 500, clientY: 500});
            fireEvent.pointerMove(handle, {pointerId: 1, clientX: 500 + dx, clientY: 500 + dy});
            fireEvent.pointerUp(handle, {pointerId: 1});
        };
        drag("se", -100, -100);
        expect(area()).toEqual(["1 / span 7", "2 / span 5"]);
        drag("ne", -100, 0);
        expect(area()).toEqual(["1 / span 6", "2 / span 5"]);
        drag("nw", 100, 100);
        expect(area()).toEqual(["2 / span 5", "3 / span 4"]);
        drag("sw", -100, 100);
        expect(area()).toEqual(["1 / span 6", "3 / span 5"]);
        // The minimum size of a chart is 4×3: the dragged edge stops there.
        drag("nw", 500, 500);
        expect(area()).toEqual(["3 / span 4", "5 / span 3"]);
        // Shift+arrows still resize the selected block.
        fireEvent.keyDown(window, {key: "ArrowRight", shiftKey: true});
        expect(area()).toEqual(["3 / span 5", "5 / span 3"]);
    });

    it("hides the corner handles until a block is hovered, focused or selected", () => {
        mount();
        const handles = document.querySelectorAll(".event-live-editor__native .live-widget--chart .live-widget__corner");
        expect([...handles].map(handle => handle.getAttribute("data-corner"))).toEqual(["nw", "ne", "sw", "se"]);
        expect(document.querySelector(".live-widget__resize")).toBeNull();
    });

    it("lists problems and notes under one legend, each in its own colour", () => {
        const crowded: LiveEditorData = {Published: {...defaultLiveLayout, widgets: defaultLiveLayout.widgets.map(item => item.type === "table" ? {...item, props: {rowsPerPage: 40}} : item)}, Draft: null};
        mount(true, crowded);
        fireEvent.click(document.querySelector(".event-live-editor__warnings-toggle")!);
        const list = document.getElementById("live-warnings")!;
        expect(list.querySelectorAll(".event-live-editor__legend")).toHaveLength(1);
        expect(within(list).getByText("Не вміщується")).toBeTruthy();
        expect(list.querySelector("li.is-fit")).not.toBeNull();
    });

    it("shows one screen for all states by default, with no state tabs", () => {
        mount();
        expect(screen.getByRole("button", {name: "Один екран для всіх станів"}).getAttribute("aria-pressed")).toBe("true");
        expect(screen.queryByRole("tab", {name: /До старту/})).toBeNull();
    });

    it("turns to separate screens as copies of the one screen, and back keeping the chosen state's", () => {
        mount();
        fireEvent.click(screen.getByRole("button", {name: "Окремий екран для кожного стану"}));
        for (const name of [/До старту/, /Заморожено/, /Завершено/]) {
            fireEvent.click(screen.getByRole("tab", {name}));
            expect(document.querySelector(".event-live-editor__native .live-widget--chart")).not.toBeNull();
        }
        // Change «Завершено», then keep its screen as the one for all states.
        fireEvent.click(document.querySelector(".event-live-editor__native .live-widget--chart")!);
        fireEvent.keyDown(window, {key: "Delete"});
        fireEvent.click(within(screen.getByText("Прибрати блок?").closest("dialog, [role=alertdialog], [role=dialog]") as HTMLElement).getByRole("button", {name: "Прибрати блок"}));
        fireEvent.click(screen.getByRole("button", {name: "Один екран для всіх станів"}));
        const dialog = screen.getByText("Залишити один екран для всіх станів?").closest("dialog, [role=alertdialog], [role=dialog]") as HTMLElement;
        expect((within(dialog).getByRole("combobox", {name: "Який екран залишити"}) as HTMLSelectElement).value).toBe("finished");
        fireEvent.click(within(dialog).getByRole("button", {name: "Залишити один"}));
        expect(screen.queryByRole("tab", {name: /До старту/})).toBeNull();
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).toBeNull();
    });

    it("copies another state's screen, asking first when this one has blocks", () => {
        mount(true, separate);
        fireEvent.click(screen.getByRole("tab", {name: /До старту/}));
        expect(document.querySelector(".event-live-editor__native .live-widget--facts")).not.toBeNull();
        fireEvent.change(screen.getByRole("combobox", {name: "Скопіювати з…"}), {target: {value: "running"}});
        const dialog = () => screen.getByText("Замінити екран «До старту»?").closest("dialog, [role=alertdialog], [role=dialog]") as HTMLElement;
        fireEvent.click(within(dialog()).getByRole("button", {name: "Скасувати"}));
        expect(document.querySelector(".event-live-editor__native .live-widget--facts")).not.toBeNull();
        fireEvent.change(screen.getByRole("combobox", {name: "Скопіювати з…"}), {target: {value: "running"}});
        fireEvent.click(within(dialog()).getByRole("button", {name: "Замінити"}));
        expect(document.querySelector(".event-live-editor__native .live-widget--facts")).toBeNull();
        expect(document.querySelector(".event-live-editor__native .live-widget--chart")).not.toBeNull();
    });

    it("opens the scene of the step it undoes and redoes", () => {
        mount(true, separate);
        fireEvent.click(screen.getByRole("tab", {name: /Завершено/}));
        fireEvent.click(document.querySelector(".event-live-editor__native .live-widget--podium")!);
        fireEvent.keyDown(window, {key: "Delete"});
        fireEvent.click(within(screen.getByText("Прибрати блок?").closest("dialog, [role=alertdialog], [role=dialog]") as HTMLElement).getByRole("button", {name: "Прибрати блок"}));
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
        expect((screen.getByRole("button", {name: "Додати блок «Таймер»"}) as HTMLButtonElement).disabled).toBe(true);
    });

    it("stops at 48 widgets on a scene with a clear message instead of a failing save", () => {
        const full = Array.from({length: 48}, (_, index) => ({id: `q${index}`, type: "qr" as const, x: index % 12 + 1, y: Math.floor(index / 12) + 1, w: 1, h: 1, props: {value: "/"}}));
        mount(true, {Published: {...defaultLiveLayout, scenes: undefined, widgets: full}, Draft: null});
        fireEvent.click(screen.getByRole("button", {name: "Додати блок «QR-код»"}));
        expect(screen.getByRole("alert").textContent).toBe("На одному екрані може бути не більше 48 блоків. Приберіть зайвий блок.");
        expect(document.querySelectorAll(".event-live-editor__native .live-widget")).toHaveLength(48);
    });

    it("says on the «Заморожено» tab that the scene will not show while the freeze is not applied", async () => {
        api.settings.mockResolvedValue({ScoreboardVisibility: 0, FreezeEnabled: true, FreezeMinutes: 60, LiveFreeze: false, ChartEnabled: true, ChartTeams: 10, RowsLimit: null, OpenedAt: null,
            Freeze: {Enabled: true, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false}});
        mount(true, separate);
        fireEvent.click(screen.getByRole("tab", {name: /Заморожено/}));
        expect(await screen.findByText(/вимкнено: зал бачить живі результати, і екран цього стану не покажеться/)).toBeTruthy();
        fireEvent.click(screen.getByRole("tab", {name: /Завершено/}));
        expect(screen.queryByText(/зал бачить живі результати/)).toBeNull();
    });
});
