// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const server = vi.hoisted(() => ({get: vi.fn(), put: vi.fn(), canManage: true}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage/results-settings", useRouter: () => ({push: vi.fn(), replace: vi.fn()})}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "3f1c2d4e-0000-4000-8000-000000000001", Name: "CTF", Participation: 0, FinishTime: null, LogoURL: null}, canManage: server.canManage})}));
vi.mock("@/api/manageResults", async original => ({
    ...(await original() as object),
    getResultsSettings: server.get,
    putResultsSettings: server.put,
}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import ResultsSettingsPage from "./page";
import {ManualDraftProvider} from "@/components/event/manage/manualDraft";
import {manualDraftKey} from "@/utils/storageKeys";

function renderPage(persistedDraft = false) {
    const page = <ResultsSettingsPage />;
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{persistedDraft
        ? <ManualDraftProvider userID="manager-1" eventID="3f1c2d4e-0000-4000-8000-000000000001">{page}</ManualDraftProvider> : page}</QueryClientProvider>);
}

const settings = {ScoreboardVisibility: 1, FreezeEnabled: true, FreezeMinutes: 30, FreezeEndMode: "at_finish", FreezeBannerText: "", FreezeBannerLevel: "warning", LiveFreeze: true, ChartEnabled: true, ChartTeams: 5, RowsLimit: null};

async function chooseEnding(label: string) {
    fireEvent.pointerDown(await screen.findByRole("button", {name: "Коли відкрити підсумки"}), {button: 0, ctrlKey: false});
    fireEvent.click(await screen.findByRole("menuitemradio", {name: label}));
}

describe("Налаштування результатів, збереження без миготіння", () => {
    beforeEach(() => {window.sessionStorage.clear(); server.canManage = true; server.get.mockResolvedValue(settings);});
    afterEach(() => {cleanup(); server.get.mockReset(); server.put.mockReset();});

    it("defaults legacy settings to automatic, keeps a manual choice while freeze controls are hidden, and saves its mode", async () => {
        server.get.mockResolvedValue({...settings, FreezeEndMode: undefined});
        server.put.mockImplementation(async (_id, value) => value);
        renderPage();
        expect((await screen.findByRole("button", {name: "Коли відкрити підсумки"})).textContent).toBe("Автоматично після фінішу");
        await chooseEnding("Вручну");
        expect(screen.getByRole("button", {name: "Коли відкрити підсумки"}).textContent).toBe("Вручну");
        expect(server.put).not.toHaveBeenCalled();
        expect(screen.getByText("Після фінішу рейтинг залишиться замороженим до натискання «Відкрити підсумки»." )).toBeTruthy();
        fireEvent.click(screen.getByRole("switch", {name: "Заморожувати рейтинг перед фіналом"}));
        expect(screen.queryByRole("button", {name: "Коли відкрити підсумки"})).toBeNull();
        fireEvent.click(screen.getByRole("switch", {name: "Заморожувати рейтинг перед фіналом"}));
        expect(screen.getByRole("button", {name: "Коли відкрити підсумки"}).textContent).toBe("Вручну");
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(server.put).toHaveBeenCalledWith("3f1c2d4e-0000-4000-8000-000000000001", {...settings, FreezeEndMode: "manual"}));
    });

    it("keeps mode and dependent controls editable during save and preserves a newer mode choice", async () => {
        let finish!: (value: unknown) => void;
        server.put.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
        renderPage();
        await chooseEnding("Вручну");
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(server.put).toHaveBeenCalledTimes(1));
        expect((screen.getByRole("button", {name: "Коли відкрити підсумки"}) as HTMLButtonElement).disabled).toBe(false);
        expect((screen.getByRole("spinbutton", {name: /За скільки хвилин до фіналу/}) as HTMLInputElement).disabled).toBe(false);
        await chooseEnding("Автоматично після фінішу");
        expect(screen.getByRole("button", {name: "Коли відкрити підсумки"}).textContent).toBe("Автоматично після фінішу");
        await act(async () => {finish({...settings, FreezeEndMode: "manual"});});
        expect(screen.getByRole("button", {name: "Коли відкрити підсумки"}).textContent).toBe("Автоматично після фінішу");
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(server.put).toHaveBeenLastCalledWith("3f1c2d4e-0000-4000-8000-000000000001", settings));
    });

    it("shows the saved manual mode without permitting read-only staff to change it", async () => {
        server.canManage = false;
        server.get.mockResolvedValue({...settings, FreezeEndMode: "manual"});
        renderPage();
        const mode = await screen.findByRole("button", {name: "Коли відкрити підсумки"}) as HTMLButtonElement;
        expect(mode.textContent).toBe("Вручну");
        expect(mode.disabled).toBe(true);
    });

    it("previews authored text and style while a save preserves newer edits and the manual mode", async () => {
        server.get.mockResolvedValue({...settings, FreezeEndMode: "manual"});
        let finish!: (value: unknown) => void;
        server.put.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
        const {container} = renderPage();
        const text = await screen.findByRole("textbox", {name: "Текст банера"}) as HTMLTextAreaElement;
        const preview = () => container.querySelector(".event-banner-preview .ib-banner")!;
        expect(preview().textContent).toBe("Результати заморожено. Оновлені результати зʼявляться після підбиття підсумків.");
        expect(preview().getAttribute("data-level")).toBe("warning");
        expect(preview().querySelector("button")).toBeNull();
        fireEvent.change(text, {target: {value: "До церемонії <em>нагородження</em>"}});
        fireEvent.pointerDown(screen.getByRole("button", {name: "Стиль банера"}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "Важливо"}));
        expect(preview().textContent).toBe("До церемонії <em>нагородження</em>");
        expect(preview().querySelector("em")).toBeNull();
        expect(preview().getAttribute("data-level")).toBe("critical");
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(server.put).toHaveBeenCalledWith("3f1c2d4e-0000-4000-8000-000000000001", {...settings, FreezeEndMode: "manual", FreezeBannerText: text.value, FreezeBannerLevel: "critical"}));
        expect(text.disabled).toBe(false);
        expect((screen.getByRole("button", {name: "Стиль банера"}) as HTMLButtonElement).disabled).toBe(false);
        fireEvent.change(text, {target: {value: "Нове повідомлення"}});
        await act(async () => {finish({...settings, FreezeEndMode: "manual", FreezeBannerText: "До церемонії <em>нагородження</em>", FreezeBannerLevel: "critical"});});
        expect(preview().textContent).toBe("Нове повідомлення");
        expect(text.value).toBe("Нове повідомлення");
        expect(screen.getByRole("button", {name: "Коли відкрити підсумки"}).textContent).toBe("Вручну");
        fireEvent.change(text, {target: {value: "   "}});
        expect(preview().textContent).toBe("Результати заморожено. Оновлені результати зʼявляться після підбиття підсумків.");
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(server.put).toHaveBeenLastCalledWith("3f1c2d4e-0000-4000-8000-000000000001", {...settings, FreezeEndMode: "manual", FreezeBannerText: "", FreezeBannerLevel: "critical"}));
    });

    it("validates the banner beside its field using the 280-character Unicode limit", async () => {
        renderPage();
        const text = await screen.findByRole("textbox", {name: "Текст банера"}) as HTMLTextAreaElement;
        fireEvent.change(text, {target: {value: "🧊".repeat(281)}});
        expect(text.value).toBe("🧊".repeat(281));
        expect(text.getAttribute("aria-invalid")).toBe("true");
        expect(text.getAttribute("aria-describedby")).toContain("results-freeze-banner-error");
        expect(screen.getByText("Не більше 280 символів.").id).toBe("results-freeze-banner-error");
        expect((screen.getByRole("button", {name: "Зберегти"}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(text, {target: {value: "🧊".repeat(280)}});
        expect(text.getAttribute("aria-invalid")).not.toBe("true");
        expect((screen.getByRole("button", {name: "Зберегти"}) as HTMLButtonElement).disabled).toBe(false);
    });

    it.each([
        {serverFields: {}, expected: {FreezeEndMode: "at_finish", FreezeBannerText: "", FreezeBannerLevel: "warning"}},
        {serverFields: {FreezeEndMode: "manual", FreezeBannerText: "Дочекайтеся нагородження", FreezeBannerLevel: "critical"}, expected: {FreezeEndMode: "manual", FreezeBannerText: "Дочекайтеся нагородження", FreezeBannerLevel: "critical"}},
    ])("restores an older draft without losing server freeze settings: $expected.FreezeEndMode", async ({serverFields, expected}) => {
        const legacy = {ScoreboardVisibility: 1, FreezeEnabled: true, FreezeMinutes: 20, LiveFreeze: true, ChartEnabled: true, ChartTeams: 5, RowsLimit: null};
        server.get.mockResolvedValue({...legacy, ...serverFields});
        server.put.mockImplementation(async (_eventID, input) => input);
        const eventID = "3f1c2d4e-0000-4000-8000-000000000001";
        window.sessionStorage.setItem(manualDraftKey("manager-1", eventID, "/manage/results-settings", "results"), JSON.stringify({version: 1, dirty: true, value: {eventID, value: legacy}}));
        renderPage(true);
        const text = await screen.findByRole("textbox", {name: "Текст банера"}) as HTMLTextAreaElement;
        expect(text.value).toBe(expected.FreezeBannerText);
        expect(screen.getByRole("button", {name: "Коли відкрити підсумки"}).textContent).toBe(expected.FreezeEndMode === "manual" ? "Вручну" : "Автоматично після фінішу");
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(server.put).toHaveBeenCalledWith(eventID, {...legacy, ...expected}));
    });

    it("only the save button is busy while a save is pending; every field stays enabled and a newer edit survives the answer", async () => {
        let finish: (value: unknown) => void = () => undefined;
        server.put.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
        renderPage();
        const minutes = await screen.findByRole("spinbutton", {name: /За скільки хвилин до фіналу/}) as HTMLInputElement;
        fireEvent.change(minutes, {target: {value: "20"}});
        fireEvent.click(await screen.findByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(server.put).toHaveBeenCalledTimes(1));
        expect(minutes.disabled).toBe(false);
        expect((screen.getAllByRole("switch") as HTMLElement[]).every(control => !control.hasAttribute("disabled"))).toBe(true);
        fireEvent.change(minutes, {target: {value: "25"}});
        finish({ScoreboardVisibility: 1, FreezeEnabled: true, FreezeMinutes: 20, ChartEnabled: true, ChartTeams: 5, RowsLimit: null});
        await waitFor(() => expect(minutes.value).toBe("25"));
        expect(await screen.findByRole("button", {name: "Зберегти"})).toBeTruthy();
    });
});
