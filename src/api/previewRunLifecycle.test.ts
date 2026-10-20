import {expect, it, vi} from "vitest";
import {previewRunStartsSuspended, suspendPreviewRunStarts, trackPreviewRunStart} from "./previewRunLifecycle";

it("blocks new starts immediately and drains an already-sent launch before cleanup", async () => {
    let finish!: (value: string) => void;
    const pending = trackPreviewRunStart("event-barrier", () => new Promise<string>(resolve => {finish = resolve;}));
    await Promise.resolve();
    const barrier = suspendPreviewRunStarts("event-barrier");
    const next = vi.fn(async () => "new-run");
    expect(previewRunStartsSuspended("event-barrier")).toBe(true);
    await expect(trackPreviewRunStart("event-barrier", next)).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
    const drained = vi.fn(); const wait = barrier.drain().then(drained);
    await Promise.resolve(); expect(drained).not.toHaveBeenCalled();
    finish("late-run"); await pending; await wait;
    expect(drained).toHaveBeenCalledOnce();
    barrier.release(); barrier.release();
    expect(previewRunStartsSuspended("event-barrier")).toBe(false);
    await expect(trackPreviewRunStart("event-barrier", next)).resolves.toBe("new-run");
});
it("isolates events and lets cleanup proceed after a failed launch", async () => {
    const first = suspendPreviewRunStarts("event-a");
    await expect(trackPreviewRunStart("event-b", async () => "other-event")).resolves.toBe("other-event");
    const failing = trackPreviewRunStart("event-c", async () => {throw new Error("refused");});
    const second = suspendPreviewRunStarts("event-c");
    await expect(failing).rejects.toThrow("refused"); await second.drain();
    first.release(); second.release();
});
