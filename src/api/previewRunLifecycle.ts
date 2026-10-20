type RunOperations = {suspended: number; pending: Set<Promise<unknown>>};
const operations = new Map<string, RunOperations>();
function forEvent(eventID: string): RunOperations {
    let state = operations.get(eventID);
    if (!state) {state = {suspended: 0, pending: new Set()}; operations.set(eventID, state);}
    return state;
}
export const previewRunStartsSuspended = (eventID: string) => (operations.get(eventID)?.suspended ?? 0) > 0;

// Every preview launch (automatic and manual) participates in the same cleanup barrier.
export async function trackPreviewRunStart<T>(eventID: string, start: () => Promise<T>): Promise<T> {
    const state = forEvent(eventID);
    if (state.suspended) throw new Error("Preview run cleanup is in progress");
    const pending = Promise.resolve().then(start);
    state.pending.add(pending);
    try {return await pending;}
    finally {state.pending.delete(pending); if (!state.suspended && !state.pending.size) operations.delete(eventID);}
}

export function suspendPreviewRunStarts(eventID: string) {
    const state = forEvent(eventID);
    state.suspended++;
    let released = false;
    return {
        async drain() {while (state.pending.size) await Promise.allSettled([...state.pending]);},
        release() {
            if (released) return;
            released = true; state.suspended--;
            if (!state.suspended && !state.pending.size) operations.delete(eventID);
        },
    };
}
