import {describe, expect, it} from "vitest";
import {countdownParts, countdownPhase, nextPhaseChange, type CountdownSchedule} from "./eventCountdown";

const start = Date.parse("2026-10-01T10:00:00Z");
const finish = Date.parse("2026-10-01T14:00:00Z");
const schedule: CountdownSchedule = {
    StartTime: "2026-10-01T10:00:00Z", FinishTime: "2026-10-01T14:00:00Z",
    ShowStartCountdown: true, ShowFinishCountdown: true, FinishCountdownMinutes: 10,
};
const minute = 60_000;

describe("countdownPhase", () => {
    it("counts to the start before it", () => {
        expect(countdownPhase(schedule, start - 5 * minute)).toEqual({kind: "start", target: start});
    });
    it("is silent before the start when the start countdown is off", () => {
        expect(countdownPhase({...schedule, ShowStartCountdown: false}, start - minute)).toBeNull();
    });
    it("shows nothing between the start and the last minutes", () => {
        expect(countdownPhase(schedule, start)).toBeNull();
        expect(countdownPhase(schedule, finish - 10 * minute - 1)).toBeNull();
    });
    it("counts to the finish only in the last N minutes", () => {
        expect(countdownPhase(schedule, finish - 10 * minute)).toEqual({kind: "finish", target: finish});
        expect(countdownPhase(schedule, finish - 1000)).toEqual({kind: "finish", target: finish});
        expect(countdownPhase({...schedule, FinishCountdownMinutes: 30}, finish - 25 * minute)).toEqual({kind: "finish", target: finish});
    });
    it("never shows the finish countdown before the start", () => {
        const short = {...schedule, FinishTime: "2026-10-01T10:05:00Z", FinishCountdownMinutes: 60};
        expect(countdownPhase(short, start - minute)).toEqual({kind: "start", target: start});
        expect(countdownPhase({...short, ShowStartCountdown: false}, start - minute)).toBeNull();
        expect(countdownPhase(short, start)).toEqual({kind: "finish", target: Date.parse(short.FinishTime)});
    });
    it("says the event finished at zero", () => {
        expect(countdownPhase(schedule, finish)).toEqual({kind: "finished"});
        expect(countdownPhase(schedule, finish + 60 * minute)).toEqual({kind: "finished"});
    });
    it("shows nothing about the finish when it is off or the event has no finish", () => {
        expect(countdownPhase({...schedule, ShowFinishCountdown: false}, finish - minute)).toBeNull();
        expect(countdownPhase({...schedule, ShowFinishCountdown: false}, finish + minute)).toBeNull();
        expect(countdownPhase({...schedule, FinishTime: null}, finish - minute)).toBeNull();
    });
});

describe("countdownParts", () => {
    it("splits the remaining time and never goes negative", () => {
        expect(countdownParts(1_000_000 + ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000, 1_000_000)).toEqual({days: 2, hours: 3, minutes: 4, seconds: 5});
        expect(countdownParts(1000, 5000)).toEqual({days: 0, hours: 0, minutes: 0, seconds: 0});
    });
});

describe("nextPhaseChange", () => {
    it("names the next boundary and ends after the finish", () => {
        expect(nextPhaseChange(schedule, start - minute)).toBe(start);
        expect(nextPhaseChange(schedule, start + minute)).toBe(finish - 10 * minute);
        expect(nextPhaseChange(schedule, finish - minute)).toBe(finish);
        expect(nextPhaseChange(schedule, finish)).toBeNull();
    });
});

describe("the finish countdown mode and the stages", () => {
    it("from_start shows it from the start of the event (no stages)", () => {
        const fromStart = {...schedule, FinishCountdownMode: "from_start" as const};
        expect(countdownPhase(fromStart, start)).toEqual({kind: "finish", target: finish});
        expect(countdownPhase(fromStart, start + 60 * minute)).toEqual({kind: "finish", target: finish});
        expect(nextPhaseChange(fromStart, start - minute)).toBe(start);
    });

    it("before_end is the default and unchanged", () => {
        expect(countdownPhase({...schedule, FinishCountdownMode: "before_end"}, start + minute)).toBeNull();
    });

    it("on an event with stages the event end is the last stage's countdown: held back until it opens", () => {
        const lastOpens = finish - 90 * minute;
        expect(countdownPhase(schedule, finish - 5 * minute, Infinity)).toBeNull();
        expect(countdownPhase(schedule, finish - 5 * minute, lastOpens)).toEqual({kind: "finish", target: finish});
        const fromStart = {...schedule, FinishCountdownMode: "from_start" as const};
        expect(countdownPhase(fromStart, lastOpens - minute, lastOpens)).toBeNull();
        expect(countdownPhase(fromStart, lastOpens, lastOpens)).toEqual({kind: "finish", target: finish});
        // the last N minutes before the last stage opens never show it early
        expect(countdownPhase({...schedule, FinishCountdownMinutes: 120}, finish - 100 * minute, lastOpens)).toBeNull();
        expect(nextPhaseChange(fromStart, start + minute, lastOpens)).toBe(lastOpens);
    });
});
