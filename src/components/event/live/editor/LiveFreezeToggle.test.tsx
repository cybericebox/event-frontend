// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const api = vi.hoisted(() => ({get: vi.fn(), put: vi.fn()}));
vi.mock("@/api/manageResults", async original => ({...await original<typeof import("@/api/manageResults")>(), getResultsSettings: api.get, putResultsSettings: api.put}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {toast} from "react-hot-toast";
import {LiveFreezeToggle} from "./LiveScreenSettings";

afterEach(() => {cleanup(); vi.clearAllMocks();});

const settings = (LiveFreeze: boolean) => ({ScoreboardVisibility: 1, FreezeEnabled: true, FreezeMinutes: 30, FreezeEndMode: "manual", FreezeBannerText: "До нагородження", FreezeBannerLevel: "critical", LiveFreeze,
    ChartEnabled: true, ChartTeams: 5, RowsLimit: null, OpenedAt: null,
    Freeze: {Enabled: true, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false}});
const setup = () => render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><LiveFreezeToggle eventID="e1" canManage /></QueryClientProvider>);
const box = () => screen.getByRole("switch") as HTMLInputElement;

describe("LiveFreezeToggle", () => {
    it("flips at once and stays enabled while the save is pending", async () => {
        api.get.mockResolvedValue(settings(true));
        let release: (value: unknown) => void = () => undefined;
        api.put.mockImplementation(() => new Promise(resolve => {release = resolve;}));
        setup();
        await waitFor(() => expect(box().disabled).toBe(false));
        fireEvent.click(box());
        await waitFor(() => expect(box().checked).toBe(false));
        expect(box().disabled).toBe(false);
        await act(async () => {release(settings(false));});
        expect(box().checked).toBe(false);
    });

    it("rolls back with a toast when the save fails", async () => {
        api.get.mockResolvedValue(settings(true));
        api.put.mockRejectedValue(new Error("boom"));
        setup();
        await waitFor(() => expect(box().disabled).toBe(false));
        fireEvent.click(box());
        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        await waitFor(() => expect(box().checked).toBe(true));
    });

    it("keeps manual unfreezing while queued live-freeze saves preserve the latest choice", async () => {
        api.get.mockResolvedValue(settings(true));
        const release: Array<() => void> = [];
        api.put.mockImplementation((_eventID, input) => new Promise(resolve => {release.push(() => resolve(settings(input.LiveFreeze)));}));
        setup();
        await waitFor(() => expect(box().disabled).toBe(false));
        fireEvent.click(box());
        await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(box().checked).toBe(false));
        fireEvent.click(box());
        await waitFor(() => expect(box().checked).toBe(true));
        expect(box().disabled).toBe(false);
        expect(api.put).toHaveBeenCalledTimes(1);
        await act(async () => {release[0]();});
        await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
        expect(api.put.mock.calls[0][1]).toMatchObject({LiveFreeze: false, FreezeEndMode: "manual", FreezeBannerText: "До нагородження", FreezeBannerLevel: "critical"});
        expect(api.put.mock.calls[1][1]).toMatchObject({LiveFreeze: true, FreezeEndMode: "manual", FreezeBannerText: "До нагородження", FreezeBannerLevel: "critical"});
        expect(box().checked).toBe(true);
        await act(async () => {release[1]();});
        expect(box().checked).toBe(true);
    });
});
