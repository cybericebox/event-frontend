// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const api = vi.hoisted(() => ({get: vi.fn(), put: vi.fn()}));
vi.mock("@/api/manageResults", () => ({getResultsSettings: api.get, putResultsSettings: api.put, resultsSettingsInput: (value: object) => value}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {toast} from "react-hot-toast";
import {LiveFreezeToggle} from "./LiveScreenSettings";

afterEach(() => {cleanup(); vi.clearAllMocks();});

const settings = (LiveFreeze: boolean) => ({FreezeEnabled: true, LiveFreeze});
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
});
