// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider, useQuery} from "@tanstack/react-query";
import type {ManageNotificationSubscription} from "@/api/manageNotifications";

const api = vi.hoisted(() => ({put: vi.fn()}));
vi.mock("@/api/manageNotifications", () => ({putManageNotificationSubscription: api.put}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {toast} from "react-hot-toast";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {useSubscriptionToggle} from "./useSubscriptionToggle";

afterEach(() => {cleanup(); vi.clearAllMocks();});

const key = ["event-manage-notification-subscriptions", "e1"];
const row = (SignalType: string, Enabled = false) => ({SignalType, Channel: "email", Enabled, Audience: "participants", Required: false, Source: "platform", Config: {}}) as unknown as ManageNotificationSubscription;

function Harness() {
    const {data = []} = useQuery({queryKey: key, queryFn: async () => [row("a"), row("b")]});
    const toggle = useSubscriptionToggle("e1", true, {success: "ok", failure: "fail"});
    return <>{data.map(item => <EventSwitch key={item.SignalType} checked={item.Enabled} ariaLabel={item.SignalType} onCheckedChange={enabled => toggle(item.SignalType, "email", enabled)} />)}</>;
}
const setup = () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
    return client;
};
const box = (name: string) => screen.getByRole("switch", {name}) as HTMLInputElement;

describe("useSubscriptionToggle", () => {
    it("shows the choice at once, keeps every switch enabled and queues quick changes", async () => {
        const pending: Array<(value: ManageNotificationSubscription) => void> = [];
        api.put.mockImplementation(() => new Promise(resolve => {pending.push(resolve);}));
        setup();
        await waitFor(() => expect(box("a")).toBeTruthy());
        fireEvent.click(box("a"));
        // Optimistic value and nothing disabled while the save is pending.
        await waitFor(() => expect(box("a").checked).toBe(true));
        expect(box("a").disabled).toBe(false);
        expect(box("b").disabled).toBe(false);
        fireEvent.click(box("b"));
        await waitFor(() => expect(box("b").checked).toBe(true));
        // The second save waits for the first: one request at a time.
        expect(api.put).toHaveBeenCalledTimes(1);
        await act(async () => {pending[0](row("a", true));});
        await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
        await act(async () => {pending[1](row("b", true));});
        expect(box("a").checked && box("b").checked).toBe(true);
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("rolls back and shows a toast when the save fails", async () => {
        let fail: (error: Error) => void = () => undefined;
        api.put.mockImplementation(() => new Promise((_, reject) => {fail = reject;}));
        const client = setup();
        const invalidate = vi.spyOn(client, "invalidateQueries");
        await waitFor(() => expect(box("a")).toBeTruthy());
        fireEvent.click(box("a"));
        await waitFor(() => expect(box("a").checked).toBe(true));
        await act(async () => {fail(new Error("boom"));});
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("fail"));
        expect(invalidate).toHaveBeenCalledWith({queryKey: key});
        await waitFor(() => expect(box("a").checked).toBe(false));
    });
});
