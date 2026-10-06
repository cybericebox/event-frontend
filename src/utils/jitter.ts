// ms spread by ±20 %: many open pages then do not reach the server in step
// (after a restart, a broadcast change or a shared poll period).
export function jitter(ms: number, random: () => number = Math.random): number {
    return Math.round(ms * (0.8 + 0.4 * random()));
}
