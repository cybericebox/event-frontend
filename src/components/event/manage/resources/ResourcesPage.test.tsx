// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
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
