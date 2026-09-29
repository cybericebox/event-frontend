// Participant countdown on «Завдання» and «Результати»: which phase the schedule
// is in now, and how much time is left. Pure functions of the event info and the
// clock, so the page can tick them every second.

export type CountdownSchedule = {
    StartTime: string;
    FinishTime: string | null;
    ShowStartCountdown: boolean;
    ShowFinishCountdown: boolean;
    FinishCountdownMinutes: number;
};

export type CountdownPhase =
    | {kind: "start"; target: number}
    | {kind: "finish"; target: number}
    | {kind: "finished"};

// The start countdown runs until the start; the finish countdown only during the
// last FinishCountdownMinutes before the finish (never before the start); at the
// finish the block turns into «Захід завершено». null = nothing to show.
export function countdownPhase(event: CountdownSchedule, now: number): CountdownPhase | null {
    const start = Date.parse(event.StartTime);
    const finish = event.FinishTime ? Date.parse(event.FinishTime) : NaN;
    if (Number.isFinite(start) && now < start) return event.ShowStartCountdown ? {kind: "start", target: start} : null;
    if (!Number.isFinite(finish) || !event.ShowFinishCountdown) return null;
    if (now >= finish) return {kind: "finished"};
    const shownFrom = Math.max(finish - event.FinishCountdownMinutes * 60_000, Number.isFinite(start) ? start : 0);
    return now >= shownFrom ? {kind: "finish", target: finish} : null;
}

export type CountdownParts = {days: number; hours: number; minutes: number; seconds: number};

export function countdownParts(target: number, now: number): CountdownParts {
    const total = Math.max(0, Math.floor((target - now) / 1000));
    return {days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60};
}

// The next moment the shown phase can change on its own: the start, the moment the
// finish countdown appears, or the finish. null = it never changes again.
export function nextPhaseChange(event: CountdownSchedule, now: number): number | null {
    const start = Date.parse(event.StartTime);
    const finish = event.FinishTime ? Date.parse(event.FinishTime) : NaN;
    const points = [start, Number.isFinite(finish) ? finish - event.FinishCountdownMinutes * 60_000 : NaN, finish];
    const upcoming = points.filter(point => Number.isFinite(point) && point > now);
    return upcoming.length ? Math.min(...upcoming) : null;
}
