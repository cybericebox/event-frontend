// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ResourcesPage} from "./ResourcesPage";

const mocks = vi.hoisted(() => ({get: vi.fn(), canManage: true}));
vi.mock("@/api/manageResources", async importOriginal => ({...await importOriginal<typeof import("@/api/manageResources")>(), getManageResources: mocks.get}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e"}, canManage: mocks.canManage})}));
vi.mock("@/components/event/EventLoading", () => ({EventLoading: () => <div>loading</div>}));
vi.mock("./ChangeRequestDialog", () => ({ChangeRequestDialog: () => null}));
afterEach(() => { cleanup(); vi.resetAllMocks(); mocks.canManage = true; });

const amount = (cpu: number, memory: number) => ({CPUMillicores: cpu, MemoryBytes: memory});
const GB = 1024 ** 3;
const data = {Reserved: true, From: null, To: "2026-10-05T13:00:00Z", Teams: 3, Allocated: amount(828, 8 * GB), InUse: amount(0, 3 * GB), Free: amount(250, 5 * GB), BufferPercent: 10, Dynamic: null, Covered: true, Changes: []};

function renderPage() {
    mocks.get.mockResolvedValue(data);
    render(<QueryClientProvider client={new QueryClient()}><ResourcesPage /></QueryClientProvider>);
}

describe("ResourcesPage", () => {
    it("puts the request button in the page header and shows the reserve in GB with «Діє до»", async () => {
        renderPage();
        const button = await screen.findByRole("button", {name: "Попросити більше ресурсів"});
        expect(button.closest(".event-manage-heading__actions")?.parentElement?.tagName).toBe("HEADER");
        const facts = document.querySelector(".event-resources__facts")!.textContent!;
        expect(facts).toContain("Діє до");
        expect(facts).toContain("Зарезервовано8\u00A0ГБ");
        expect(facts).toContain("Зайнято3\u00A0ГБ");
        expect(facts).toContain("Вільно5\u00A0ГБ");
        expect(facts).not.toMatch(/мілі|vCPU|ГіБ|МіБ/);
    });

    it("shows no shortage line while the usage fits the reserve", async () => {
        renderPage();
        await screen.findByRole("button", {name: "Попросити більше ресурсів"});
        expect(screen.queryByTestId("resources-shortage")).toBeNull();
    });

    it("shows the shortage line only when the usage is above the reserve", async () => {
        mocks.get.mockResolvedValue({...data, InUse: amount(0, 9.5 * GB), Free: amount(0, 0)});
        render(<QueryClientProvider client={new QueryClient()}><ResourcesPage /></QueryClientProvider>);
        expect((await screen.findByTestId("resources-shortage")).textContent).toBe("Резерв не вміщується: бракує 1,5\u00A0ГБ");
    });

    it("keeps the decision time and its note apart", async () => {
        mocks.get.mockResolvedValue({...data, Changes: [{ID: "c1", RequestedAt: "2026-10-17T10:00:00Z", Size: amount(0, 8 * GB), Dynamic: null, WindowStart: null, WindowEnd: null,
            Reason: "Більше команд", Status: "rejected", DecidedAt: "2026-10-18T01:42:00Z", DecisionNote: "Забагато пам'яті"}]});
        render(<QueryClientProvider client={new QueryClient()}><ResourcesPage /></QueryClientProvider>);
        const note = await screen.findByText("Забагато пам'яті");
        const time = note.parentElement!.querySelector("time")!;
        expect(time).toBeTruthy();
        expect(note.className).toContain("event-resources__decision");
        expect(time.closest(".event-resources__decision")).not.toBe(note);
    });

    it("disables «Попросити більше ресурсів» while a request is still being reviewed", async () => {
        mocks.get.mockResolvedValue({...data, Changes: [{ID: "c1", RequestedAt: "2026-10-17T10:00:00Z", Size: amount(0, 8 * GB), Dynamic: null, WindowStart: null, WindowEnd: null,
            Reason: "", Status: "pending", DecidedAt: null, DecisionNote: ""}]});
        render(<QueryClientProvider client={new QueryClient()}><ResourcesPage /></QueryClientProvider>);
        const button = await screen.findByRole("button", {name: "Попросити більше ресурсів"}) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        expect(screen.getByText("Запит уже розглядається")).toBeTruthy();
    });

    it("hides the button from viewers who cannot manage", async () => {
        mocks.canManage = false;
        renderPage();
        await screen.findByText("Діє до");
        expect(screen.queryByRole("button", {name: "Попросити більше ресурсів"})).toBeNull();
    });
});

import {observation} from "@/test/labObservations";
it("retains existing facts and their DOM through a failed background refresh", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    mocks.get.mockResolvedValue({...data, Observation: {...observation, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "512"}});
    render(<QueryClientProvider client={client}><ResourcesPage /></QueryClientProvider>);
    const held = await screen.findByTestId("observation-held");
    const button = screen.getByRole("button", {name: "Попросити більше ресурсів"});
    mocks.get.mockRejectedValue(new Error("offline"));
    await act(async () => {await client.refetchQueries({queryKey: ["event-management-resources", "e"]});});
    await waitFor(() => expect(screen.getByText("Фізичне сховище").parentElement?.textContent).toContain("Невідомо"));
    expect(screen.queryByText("Спостереження актуальні")).toBeNull();
    expect(screen.getByTestId("observation-held")).toBe(held);
    expect(screen.getByRole("button", {name: "Попросити більше ресурсів"})).toBe(button);
});
