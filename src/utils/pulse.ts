import {getPulse, type Pulse} from "@/api/pulse";
import {jitter} from "./jitter";

// One pulse loop per tab and event, shared by the banner bar and the inbox button.
// Every ~30 s (±20 %) while the tab is visible; paused when hidden; one immediate
// pulse when the tab becomes visible, gets focus or goes online (at most once per 5 s).
export const PULSE_INTERVAL_MS = 30_000;
export const PULSE_MIN_GAP_MS = 5_000;

export type PulseListener = (pulse: Pulse) => void;

export type PulseLoop = {
    subscribe(listener: PulseListener): () => void;
    /** One pulse now (a local change such as «inbox updated»); joins one already in flight. */
    now(): void;
};

export function createPulseLoop(fetchPulse: () => Promise<Pulse>, random: () => number = Math.random): PulseLoop {
    const listeners = new Set<PulseListener>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let inFlight = false;
    let rerun = false;
    let startedAt = -Infinity;
    let last: Pulse | null = null;

    const visible = () => document.visibilityState !== "hidden";
    const unschedule = () => { if (timer !== undefined) { clearTimeout(timer); timer = undefined; } };
    const schedule = () => {
        unschedule();
        if (!running || !visible()) return;
        timer = setTimeout(() => { timer = undefined; if (visible()) void run(); }, jitter(PULSE_INTERVAL_MS, random));
    };

    async function run(): Promise<void> {
        if (!running) return;
        if (inFlight) { rerun = true; return; }
        inFlight = true;
        startedAt = Date.now();
        unschedule();
        try {
            const pulse = await fetchPulse();
            if (running) {
                last = pulse;
                for (const listener of [...listeners]) listener(pulse);
            }
        } catch { /* a failed pulse is skipped; the next one asks again */ }
        finally {
            inFlight = false;
            if (rerun && running) { rerun = false; void run(); } else schedule();
        }
    }

    const wake = () => {
        if (!running || !visible()) return;
        if (Date.now() - startedAt >= PULSE_MIN_GAP_MS) void run(); else schedule();
    };
    const onVisibility = () => { if (visible()) wake(); else unschedule(); };

    function start() {
        running = true;
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("focus", wake);
        window.addEventListener("online", wake);
        void run();
    }
    function stop() {
        running = false;
        rerun = false;
        last = null;
        unschedule();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("focus", wake);
        window.removeEventListener("online", wake);
    }

    return {
        subscribe(listener) {
            listeners.add(listener);
            if (!running) start();
            else if (last) {
                const replay = last;
                queueMicrotask(() => { if (listeners.has(listener)) listener(replay); });
            }
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) stop();
            };
        },
        now() { void run(); },
    };
}

const loops = new Map<string, PulseLoop>();
function loopFor(eventID: string): PulseLoop {
    let loop = loops.get(eventID);
    if (!loop) { loop = createPulseLoop(() => getPulse(eventID)); loops.set(eventID, loop); }
    return loop;
}

export function subscribePulse(eventID: string, listener: PulseListener): () => void {
    return loopFor(eventID).subscribe(listener);
}

export function pulseNow(eventID: string): void {
    loops.get(eventID)?.now();
}
