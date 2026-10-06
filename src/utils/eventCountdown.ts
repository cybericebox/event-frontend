// Participant countdown on «Завдання» and «Результати»: which phase the schedule
// is in now, and how much time is left. Pure functions of the event info and the
// clock, so the page can tick them every second.

export type CountdownSchedule = {
    StartTime: string;
    FinishTime: string | null;
    ShowStartCountdown: boolean;
    ShowFinishCountdown: boolean;
    FinishCountdownMinutes: number;
    // before_end (default): the finish countdown shows during the last FinishCountdownMinutes; from_start: from the start
    // of the current stage, of the event when it has no stages.
    FinishCountdownMode?: "before_end" | "from_start";
};

export type CountdownPhase =
    | {kind: "start"; target: number}
    | {kind: "finish"; target: number}
    | {kind: "finished"};

// The start countdown runs until the start; the finish countdown only during the
// last FinishCountdownMinutes before the finish (never before the start), or from the start of the
// current stage in the from_start mode; at the finish the block turns into «Захід завершено».
// finishFrom is the earliest moment the finish countdown may show: the start of the event's last stage
// (the event end is the last stage's countdown), or Infinity while another stage runs; undefined = no stages.
// null = nothing to show.
export function countdownPhase(event: CountdownSchedule, now: number, finishFrom?: number): CountdownPhase | null {
    const start = Date.parse(event.StartTime);
    const finish = event.FinishTime ? Date.parse(event.FinishTime) : NaN;
    if (Number.isFinite(start) && now < start) return event.ShowStartCountdown ? {kind: "start", target: start} : null;
    if (!Number.isFinite(finish) || !event.ShowFinishCountdown) return null;
    if (now >= finish) return {kind: "finished"};
    return now >= finishShownFrom(event, start, finish, finishFrom) ? {kind: "finish", target: finish} : null;
}

function finishShownFrom(event: CountdownSchedule, start: number, finish: number, finishFrom?: number): number {
    const floor = Number.isFinite(start) ? start : 0;
    const shownFrom = event.FinishCountdownMode === "from_start" ? floor : Math.max(finish - event.FinishCountdownMinutes * 60_000, floor);
    return finishFrom === undefined ? shownFrom : Math.max(shownFrom, finishFrom);
}

export type CountdownParts = {days: number; hours: number; minutes: number; seconds: number};

export function countdownParts(target: number, now: number): CountdownParts {
    const total = Math.max(0, Math.floor((target - now) / 1000));
    return {days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60};
}

// The next moment the shown phase can change on its own: the start, the moment the
// finish countdown appears, or the finish. null = it never changes again.
export function nextPhaseChange(event: CountdownSchedule, now: number, finishFrom?: number): number | null {
    const start = Date.parse(event.StartTime);
    const finish = event.FinishTime ? Date.parse(event.FinishTime) : NaN;
    const shown = Number.isFinite(finish) ? finishShownFrom(event, start, finish, finishFrom) : NaN;
    const points = [start, shown, finish];
    const upcoming = points.filter(point => Number.isFinite(point) && point > now);
    return upcoming.length ? Math.min(...upcoming) : null;
}
