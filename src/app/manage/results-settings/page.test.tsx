// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const server = vi.hoisted(() => ({put: vi.fn()}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "3f1c2d4e-0000-4000-8000-000000000001", Name: "CTF", Participation: 0, FinishTime: null, LogoURL: null}, canManage: true})}));
vi.mock("@/api/manageResults", async original => ({
    ...(await original() as object),
    getResultsSettings: async () => ({ScoreboardVisibility: 1, FreezeEnabled: true, FreezeMinutes: 30, ChartEnabled: true, ChartTeams: 5, RowsLimit: null}),
    putResultsSettings: server.put,
}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import ResultsSettingsPage from "./page";

function renderPage() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ResultsSettingsPage /></QueryClientProvider>);
}

describe("Налаштування результатів, збереження без миготіння", () => {
    afterEach(() => {cleanup(); server.put.mockReset();});

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
