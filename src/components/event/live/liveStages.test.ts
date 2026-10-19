import {describe, expect, it} from "vitest";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {liveStageSubtitle, liveTimerDigits, liveTimerState, type LiveStage} from "./liveStages";

const hour = 3600_000;
const start = Date.UTC(2026, 9, 19, 9);
const at = (hours: number) => start + hours * hour;
const iso = (hours: number) => new Date(at(hours)).toISOString();
const event = (finish: number | null = 8) => ({StartTime: iso(0), FinishTime: finish === null ? null : iso(finish)}) as PublicEventInfo;
// Stage 1 09:00–11:00, a break, stage 2 12:00–15:00, the event ends at 17:00.
const stages: LiveStage[] = [
    {Name: "Етап 2", OpensAt: iso(3), ClosesAt: iso(6)},
    {Name: "Етап 1", OpensAt: iso(0), ClosesAt: iso(2)},
];
const auto = (now: number, list = stages, finish: number | null = 8) => liveTimerState({}, event(finish), list, now, null);

describe("live timer by stages", () => {
    it("counts to the start before the event", () => {
        expect(auto(at(-1))).toEqual({mode: "countdown", target: at(0), label: "До початку"});
    });

    it("counts to the end of the current stage and names it", () => {
        expect(auto(at(1))).toEqual({mode: "countdown", target: at(2), label: "До кінця: Етап 1"});
        expect(auto(at(4))).toEqual({mode: "countdown", target: at(6), label: "До кінця: Етап 2"});
    });

    it("counts to the next stage during a break", () => {
        expect(auto(at(2.5))).toEqual({mode: "countdown", target: at(3), label: "До початку: Етап 2"});
    });

    it("counts to the finish after the last stage, then shows a word instead of zeros", () => {
        expect(auto(at(7))).toEqual({mode: "countdown", target: at(8), label: "До завершення"});
        expect(auto(at(9))).toEqual({mode: "word", word: "Завершено", label: "", reason: "passed"});
    });

    it("follows a moved finish: the target is read from the event every time", () => {
        expect(auto(at(7), stages, 10)).toEqual({mode: "countdown", target: at(10), label: "До завершення"});
    });

    it("without stages counts start → finish, and shows the elapsed time without a finish", () => {
        expect(auto(at(1), [])).toEqual({mode: "countdown", target: at(8), label: "До завершення"});
        expect(auto(at(1), [], null)).toEqual({mode: "elapsed", since: at(0), label: "Триває"});
        expect(liveTimerDigits(auto(at(1.5), [], null), at(1.5), true)).toBe("01:30:00");
    });

    it("«До кінця етапу» and «До початку наступного етапу» sources", () => {
        const end = (now: number) => liveTimerState({source: "stage-end"}, event(), stages, now, null);
        const next = (now: number) => liveTimerState({source: "stage-next"}, event(), stages, now, null);
        expect(end(at(1)).mode === "countdown" && end(at(1))).toMatchObject({target: at(2)});
        expect(end(at(2.5))).toMatchObject({target: at(3), label: "До початку: Етап 2"});
        expect(end(at(7))).toEqual({mode: "word", word: "Етапи завершено", label: "", reason: "passed"});
        expect(next(at(1))).toMatchObject({target: at(3), label: "До початку: Етап 2"});
        expect(next(at(4))).toEqual({mode: "word", word: "Етапи завершено", label: "", reason: "passed"});
    });

    it("never shows 00:00:00 for a passed or missing target", () => {
        expect(liveTimerState({source: "custom"}, event(), [], at(1), null)).toMatchObject({mode: "word", word: "Не задано"});
        expect(liveTimerState({source: "custom", target: iso(0.5)}, event(), [], at(1), null)).toMatchObject({mode: "word", word: "Час вийшов"});
        expect(liveTimerState({source: "freeze"}, event(), [], at(7.5), iso(7))).toMatchObject({mode: "word", word: "Заморожено"});
        expect(liveTimerDigits({mode: "word", word: "Завершено", label: "", reason: "passed"}, at(1), true)).toBeNull();
    });

    it("gives the current stage, or the next one with its time, as the title subtitle", () => {
        expect(liveStageSubtitle(stages, at(1))).toBe("Етап 1");
        expect(liveStageSubtitle(stages, at(2.5))).toMatch(/^Далі: Етап 2 о \d\d:\d\d$/);
        expect(liveStageSubtitle(stages, at(7))).toBe("");
    });
});
