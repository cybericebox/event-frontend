// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider, useQuery} from "@tanstack/react-query";
import type {EventBoardChallenge, EventExerciseAttachment} from "@/api/manageChallenges";

const api = vi.hoisted(() => ({visibility: vi.fn(), update: vi.fn()}));
vi.mock("@/api/manageChallenges", () => ({setEventExerciseVisibility: api.visibility, updateEventBoardChallenge: api.update}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {toast} from "react-hot-toast";
import {EventSwitch} from "@/components/ui/EventSwitch";
import type {BoardSet} from "./challengeOrder";
import {useBoardMutations} from "./useBoardMutations";

afterEach(() => {cleanup(); vi.clearAllMocks();});

const challenge = (ID: string) => ({ID, Points: 100, HintsEnabled: true, Published: false, Hints: []}) as unknown as EventBoardChallenge;
const sets = (): BoardSet[] => [{attachment: {ID: "s1"} as EventExerciseAttachment, challenges: [challenge("c1"), challenge("c2")]}];

function Harness() {
    const {data = []} = useQuery({queryKey: ["event-exercise-boards", "e1", "s1:0"], queryFn: async () => sets()});
    const mutations = useBoardMutations("e1");
    const first = data[0]?.challenges ?? [];
    return <>
        <EventSwitch checked={first.some(item => item.Published)} ariaLabel="shown" onCheckedChange={value => mutations.setPublished("s1", value)} />
        {first.map(item => <EventSwitch key={item.ID} checked={item.HintsEnabled} ariaLabel={`hints-${item.ID}`} onCheckedChange={value => mutations.setHintsEnabled("s1", item.ID, value)} />)}
    </>;
}
const setup = () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
};
const box = (name: string) => screen.getByRole("switch", {name}) as HTMLInputElement;

describe("useBoardMutations", () => {
    it("publishes a set optimistically without disabling the hint switches", async () => {
        let release: () => void = () => undefined;
        api.visibility.mockImplementation(() => new Promise<void>(resolve => {release = resolve;}));
        setup();
        await waitFor(() => expect(box("shown")).toBeTruthy());
        fireEvent.click(box("shown"));
        await waitFor(() => expect(box("shown").checked).toBe(true));
        expect(box("shown").disabled).toBe(false);
        expect(box("hints-c1").disabled).toBe(false);
        await act(async () => {release();});
        expect(box("shown").checked).toBe(true);
    });

    it("turns hints off at once, queues the saves and keeps the neighbour usable", async () => {
        const pending: Array<(value: EventBoardChallenge) => void> = [];
        api.update.mockImplementation(() => new Promise(resolve => {pending.push(resolve);}));
        setup();
        await waitFor(() => expect(box("hints-c1")).toBeTruthy());
        fireEvent.click(box("hints-c1"));
        await waitFor(() => expect(box("hints-c1").checked).toBe(false));
        expect(box("hints-c2").disabled).toBe(false);
        fireEvent.click(box("hints-c2"));
        expect(api.update).toHaveBeenCalledTimes(1);
        await act(async () => {pending[0]({...challenge("c1"), HintsEnabled: false});});
        await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
        await act(async () => {pending[1]({...challenge("c2"), HintsEnabled: false});});
        expect(box("hints-c1").checked || box("hints-c2").checked).toBe(false);
    });

    it("rolls back on error with a toast", async () => {
        let fail: (error: Error) => void = () => undefined;
        api.visibility.mockImplementation(() => new Promise((_, reject) => {fail = reject;}));
        setup();
        await waitFor(() => expect(box("shown")).toBeTruthy());
        fireEvent.click(box("shown"));
        await waitFor(() => expect(box("shown").checked).toBe(true));
        await act(async () => {fail(new Error("boom"));});
        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        await waitFor(() => expect(box("shown").checked).toBe(false));
    });
});
