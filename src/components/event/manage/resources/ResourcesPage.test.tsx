// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ResourcesPage} from "./ResourcesPage";

const MIB = 1024 ** 2;
const mocks = vi.hoisted(() => ({get: vi.fn(), canManage: true}));
vi.mock("@/api/manageResources", async importOriginal => ({...await importOriginal<typeof import("@/api/manageResources")>(), getManageResources: mocks.get}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e"}, canManage: mocks.canManage})}));
vi.mock("@/components/event/EventLoading", () => ({EventLoading: () => <div>loading</div>}));
vi.mock("./ChangeRequestDialog", () => ({ChangeRequestDialog: () => null}));
afterEach(() => { cleanup(); vi.resetAllMocks(); mocks.canManage = true; });

const amount = (cpu: number, memory: number) => ({CPUMillicores: cpu, MemoryBytes: memory});
const data = {Reserved: true, From: null, To: null, Teams: 3, Allocated: amount(828, 3.375 * 1024 * MIB), InUse: amount(0, 0), Free: amount(250, 512 * MIB), BufferPercent: 10, Dynamic: null, Covered: true, Changes: []};

function renderPage() {
    mocks.get.mockResolvedValue(data);
    render(<QueryClientProvider client={new QueryClient()}><ResourcesPage /></QueryClientProvider>);
}

describe("ResourcesPage", () => {
    it("puts the request button in the page header and shows people-readable amounts", async () => {
        renderPage();
        const button = await screen.findByRole("button", {name: "Запросити зміну"});
        expect(button.closest(".event-manage-heading__actions")?.parentElement?.tagName).toBe("HEADER");
        expect(screen.getByText("828 мілі-ядер · 3,4 ГіБ")).toBeTruthy();
        expect(screen.getByText("0 vCPU · 0 Б")).toBeTruthy();
    });

    it("hides the button from viewers who cannot manage", async () => {
        mocks.canManage = false;
        renderPage();
        await screen.findByText("828 мілі-ядер · 3,4 ГіБ");
        expect(screen.queryByRole("button", {name: "Запросити зміну"})).toBeNull();
    });
});

import {observation} from "@/test/labObservations";
it("retains existing facts and their DOM through a failed background refresh", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    mocks.get.mockResolvedValue({...data, Observation: {...observation, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "512"}});
    render(<QueryClientProvider client={client}><ResourcesPage /></QueryClientProvider>);
    const held = await screen.findByTestId("observation-held");
    const button = screen.getByRole("button", {name: "Запросити зміну"});
    mocks.get.mockRejectedValue(new Error("offline"));
    await act(async () => {await client.refetchQueries({queryKey: ["event-management-resources", "e"]});});
    await waitFor(() => expect(screen.getByText("Фізичне сховище").parentElement?.textContent).toContain("Невідомо"));
    expect(screen.queryByText("Спостереження актуальні")).toBeNull();
    expect(screen.getByTestId("observation-held")).toBe(held);
    expect(screen.getByRole("button", {name: "Запросити зміну"})).toBe(button);
});
