import type {LiveWidget} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {clockLabel} from "@/utils/resultsFreeze";
import {t} from "@/i18n/t";

// A stage as the live screen needs it: the screen link sends these, the
// staff screen reads the management stage list.
export type LiveStage = {Name: string; OpensAt: string; ClosesAt: string};

export type LiveTimerSource = "auto" | "start" | "finish" | "freeze" | "custom" | "stage-end" | "stage-next";
export const liveTimerSources: LiveTimerSource[] = ["auto", "stage-end", "stage-next", "start", "finish", "freeze", "custom"];

// What the timer shows: a countdown to `target`, the time since `since`
// (a running event with no finish), or a word instead of the digits: the
// target `passed` («Завершено»), or there is `none`. Never 00:00:00.
export type LiveTimerState =
    | {mode: "countdown"; target: number; label: string}
    | {mode: "elapsed"; since: number; label: string}
    | {mode: "word"; word: string; label: string; reason: "passed" | "none"};

function time(value: string): number {
    return Date.parse(value);
}

// The stage running at `now` (opened, not closed yet).
export function liveCurrentStage(stages: LiveStage[], now: number): LiveStage | null {
    return stages.find(stage => time(stage.OpensAt) <= now && now < time(stage.ClosesAt)) ?? null;
}

// The next stage to open after `now`.
export function liveNextStage(stages: LiveStage[], now: number): LiveStage | null {
    return [...stages].sort((a, b) => time(a.OpensAt) - time(b.OpensAt)).find(stage => time(stage.OpensAt) > now) ?? null;
}

// «До кінця: Етап 1»; without the name («До кінця етапу») when the title
// already shows the stage.
function stageLabel(key: "live.timer.stageEnd" | "live.timer.stageNext", stage: LiveStage, named: boolean): string {
    return named ? t(key, {stage: stage.Name}) : t(`${key}Short`);
}

const countdown = (target: number, label: string): LiveTimerState => ({mode: "countdown", target, label});
const word = (value: string, label = "", reason: "passed" | "none" = "passed"): LiveTimerState => ({mode: "word", word: value, label, reason});

// The event without its stages: before the start → to the start, running →
// to the finish (or the time since the start when there is no finish), after
// the finish → «Завершено».
function eventState(event: PublicEventInfo, now: number): LiveTimerState {
    const start = time(event.StartTime);
    const finish = event.FinishTime ? time(event.FinishTime) : null;
    if (now < start) return countdown(start, t("live.timer.beforeStart"));
    if (finish === null) return {mode: "elapsed", since: start, label: t("live.timer.running")};
    if (now < finish) return countdown(finish, t("live.timer.untilFinish"));
    return word(t("live.timer.finished"));
}

// «Автоматично»: before the start → to the start; then to the end of the
// current stage; between stages → to the next stage; after the stages → to
// the finish; after the finish → «Завершено».
function autoState(event: PublicEventInfo, stages: LiveStage[], now: number, named: boolean): LiveTimerState {
    const start = time(event.StartTime);
    const finish = event.FinishTime ? time(event.FinishTime) : null;
    if (now < start || finish !== null && now >= finish) return eventState(event, now);
    const current = liveCurrentStage(stages, now);
    if (current) return countdown(time(current.ClosesAt), stageLabel("live.timer.stageEnd", current, named));
    const next = liveNextStage(stages, now);
    if (next && (finish === null || time(next.OpensAt) < finish)) return countdown(time(next.OpensAt), stageLabel("live.timer.stageNext", next, named));
    return eventState(event, now);
}

// The timer of a widget at `now`. `frozenAt` is the results freeze moment;
// `named`: the label names the stage (off when the title shows it).
export function liveTimerState(props: LiveWidget["props"], event: PublicEventInfo, stages: LiveStage[], now: number, frozenAt: string | null, named = true): LiveTimerState {
    const source = (typeof props.source === "string" ? props.source : "auto") as LiveTimerSource;
    if (source === "start") {
        const start = time(event.StartTime);
        return now < start ? countdown(start, t("live.timer.beforeStart")) : word(t("live.timer.started"));
    }
    if (source === "finish") {
        const finish = event.FinishTime ? time(event.FinishTime) : null;
        if (finish === null) return eventState(event, now);
        return now < finish ? countdown(finish, t("live.timer.untilFinish")) : word(t("live.timer.finished"));
    }
    if (source === "freeze") {
        const freeze = frozenAt ? time(frozenAt) : null;
        if (freeze === null) return word(t("live.timer.noTarget"), t("live.timer.untilFreeze"), "none");
        return now < freeze ? countdown(freeze, t("live.timer.untilFreeze")) : word(t("live.timer.frozen"));
    }
    if (source === "custom") {
        const target = typeof props.target === "string" ? time(props.target) || null : null;
        if (target === null) return word(t("live.timer.noTarget"), t("live.timer.untilCustom"), "none");
        return now < target ? countdown(target, t("live.timer.untilCustom")) : word(t("live.timer.timeUp"));
    }
    if (source === "stage-end") {
        const current = liveCurrentStage(stages, now);
        if (current) return countdown(time(current.ClosesAt), stageLabel("live.timer.stageEnd", current, named));
        const next = liveNextStage(stages, now);
        if (next) return countdown(time(next.OpensAt), stageLabel("live.timer.stageNext", next, named));
        return stages.length ? word(t("live.timer.stagesDone")) : autoState(event, stages, now, named);
    }
    if (source === "stage-next") {
        const next = liveNextStage(stages, now);
        if (next) return countdown(time(next.OpensAt), stageLabel("live.timer.stageNext", next, named));
        return stages.length ? word(t("live.timer.stagesDone")) : autoState(event, stages, now, named);
    }
    return autoState(event, stages, now, named);
}

// «Формат»: HH:MM:SS always («full»), MM:SS in the last hour («compact»),
// or words, «2 год 14 хв» («words»).
export const liveTimerDigitModes = ["full", "compact", "words"] as const;
export type LiveTimerDigitMode = typeof liveTimerDigitModes[number];

export function liveTimerDigitMode(value: unknown): LiveTimerDigitMode {
    return (liveTimerDigitModes as readonly unknown[]).includes(value) ? value as LiveTimerDigitMode : "full";
}

// The digits of a countdown or elapsed time: HH:MM:SS, or HH:MM without
// seconds; in the «compact» format the last hour drops its hours.
export function liveTimerDigits(state: LiveTimerState, now: number, showSeconds: boolean, format: LiveTimerDigitMode = "full"): string | null {
    if (state.mode === "word") return null;
    const span = state.mode === "countdown" ? state.target - now : now - state.since;
    const seconds = Math.max(0, Math.floor(span / 1000));
    const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60, rest = seconds % 60;
    if (format === "words") {
        if (hours) return t("live.timer.wordsHM", {hours, minutes});
        if (minutes) return showSeconds ? t("live.timer.wordsMS", {minutes, seconds: rest}) : t("live.timer.wordsM", {minutes});
        return t("live.timer.wordsS", {seconds: rest});
    }
    const pad = (part: number) => String(part).padStart(2, "0");
    if (format === "compact" && !hours) return [minutes, rest].map(pad).join(":");
    return [hours, minutes, ...(showSeconds ? [rest] : [])].map(pad).join(":");
}

// «Останні хвилини»: from `lastMinutes` before the target the timer stands
// out («urgent»); in the last minute it drops its label and grows («final»).
export function liveTimerUrgency(state: LiveTimerState, now: number, lastMinutes: number): "calm" | "urgent" | "final" {
    if (state.mode !== "countdown" || lastMinutes <= 0) return "calm";
    const left = state.target - now;
    if (left > lastMinutes * 60_000) return "calm";
    return left <= 60_000 ? "final" : "urgent";
}

export const liveLastMinutesOptions = [0, 1, 3, 5, 10, 15] as const;

// «На нулі»: the word of the passed target («word»), an own text («text»)
// or nothing at all («hide»).
export const liveTimerZeroModes = ["word", "text", "hide"] as const;
export type LiveTimerZeroMode = typeof liveTimerZeroModes[number];

// The line in the digits' place once the target passed: null hides the timer.
export function liveTimerZero(state: LiveTimerState, mode: unknown, text: unknown): string | null {
    if (state.mode !== "word") return null;
    if (state.reason !== "passed") return state.word;
    if (mode === "hide") return null;
    if (mode === "text" && typeof text === "string" && text.trim()) return text.trim();
    return state.word;
}

// «Підзаголовок = поточний етап»: the running stage, or the next one with
// its start time during a break; empty when neither.
export function liveStageSubtitle(stages: LiveStage[], now: number): string {
    const current = liveCurrentStage(stages, now);
    if (current) return current.Name;
    const next = liveNextStage(stages, now);
    return next ? t("live.stage.next", {stage: next.Name, time: clockLabel(next.OpensAt)}) : "";
}
