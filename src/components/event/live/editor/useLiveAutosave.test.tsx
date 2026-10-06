// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import {defaultLiveLayout, type LiveLayout} from "@/api/manageLive";
import {liveAutosaveDelay, liveAutosaveRetryDelay, useLiveAutosave} from "./useLiveAutosave";

const save = vi.hoisted(() => vi.fn());
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(), saveManageLiveDraft: save}));

const saved = JSON.stringify(defaultLiveLayout);
const changed: LiveLayout = {...defaultLiveLayout, theme: "light"};

function setup(layout: LiveLayout, valid = true) {
    const onSaved = vi.fn();
    const hook = renderHook(props => useLiveAutosave({eventID: "e", layout: props.layout, savedJSON: saved, valid: props.valid, enabled: true, onSaved}), {initialProps: {layout, valid}});
    return {...hook, onSaved};
}

beforeEach(() => {vi.useFakeTimers(); save.mockReset();});
afterEach(() => vi.useRealTimers());

describe("live autosave", () => {
    it("does nothing while the layout matches the saved draft", async () => {
        const {result} = setup(defaultLiveLayout);
        await act(async () => {vi.advanceTimersByTime(liveAutosaveDelay * 2);});
        expect(save).not.toHaveBeenCalled();
        expect(result.current.status).toBe("saved");
    });

    it("saves a change after the pause and reports it saved", async () => {
        save.mockResolvedValue(undefined);
        const {result, onSaved} = setup(changed);
        expect(result.current.status).toBe("pending");
        await act(async () => {vi.advanceTimersByTime(liveAutosaveDelay);});
        expect(save).toHaveBeenCalledWith("e", changed);
        expect(onSaved).toHaveBeenCalledWith(changed);
        expect(result.current.status).toBe("saved");
    });

    it("never saves an invalid layout", async () => {
        const {result} = setup(changed, false);
        await act(async () => {vi.advanceTimersByTime(liveAutosaveDelay * 2);});
        expect(save).not.toHaveBeenCalled();
        expect(result.current.status).toBe("invalid");
    });

    it("reports a failed save and retries on demand", async () => {
        save.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
        const {result} = setup(changed);
        await act(async () => {vi.advanceTimersByTime(liveAutosaveDelay);});
        expect(result.current.status).toBe("error");
        await act(async () => {result.current.retry();});
        expect(save).toHaveBeenCalledTimes(2);
        expect(result.current.status).toBe("saved");
    });

    it("retries a failed save on its own", async () => {
        save.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
        const {result} = setup(changed);
        await act(async () => {vi.advanceTimersByTime(liveAutosaveDelay);});
        expect(result.current.status).toBe("error");
        await act(async () => {vi.advanceTimersByTime(liveAutosaveRetryDelay);});
        expect(save).toHaveBeenCalledTimes(2);
        expect(result.current.status).toBe("saved");
    });

    it("flushes pending edits at once before publishing", async () => {
        save.mockResolvedValue(undefined);
        const {result} = setup(changed);
        let ok = false;
        await act(async () => {ok = await result.current.flush();});
        expect(ok).toBe(true);
        expect(save).toHaveBeenCalledTimes(1);
    });
});
