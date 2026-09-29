// @vitest-environment jsdom
import {describe, expect, it} from "vitest";
import {clampThresholds, integrityExportPath, integrityJournalHref, thresholdsEqual, type IntegritySignal, type IntegrityThresholds} from "@/api/manageAnalyticsIntegrity";
import type {AnalyticsReport} from "@/api/manageAnalyticsReport";
import {journalFiltersFromParams} from "../journalViews";
import {formatBytes, formatCpu, formatDuration, noValue} from "./analyticsFormat";
import {loadThresholds, saveThresholds} from "./integrityThresholds";
import {bucketedActivity} from "./reportCharts";

const defaults: IntegrityThresholds = {SameAnswerWindowSeconds: 120, SameAnswerMinLength: 6, IncludeCorrect: false, BurstAttempts: 15, BurstWindowSeconds: 60, FastSolveGapSeconds: 60};
const challenge = "01a0d498-32b3-7a38-8355-30cc209f56ab";
const team = "0190c6a4-0000-7000-8000-000000000001";

function signal(extra: Partial<IntegritySignal>): IntegritySignal {
    return {Kind: "same_answer", ChallengeID: challenge, ChallengeName: "Web", Teams: [{ID: team, Name: "Blue"}], From: "2026-09-29T10:00:00.000Z", To: "2026-09-29T10:01:00.000Z", Answer: "", Correct: false, Attempts: 2, Rejections: 0, GapSeconds: 0, ...extra};
}

describe("value formatting", () => {
    it("writes durations in the two most useful units", () => {
        expect(formatDuration(null)).toBe(noValue);
        expect(formatDuration(45)).toBe("45 с");
        expect(formatDuration(120)).toBe("2 хв");
        expect(formatDuration(95)).toBe("1 хв 35 с");
        expect(formatDuration(3700)).toBe("1 год 1 хв");
        expect(formatDuration(7200)).toBe("2 год");
    });

    it("picks a byte unit and shows CPU as cores", () => {
        expect(formatBytes(512)).toBe("512 Б");
        expect(formatBytes(2048)).toContain("КіБ");
        expect(formatBytes(3 * 1024 ** 3)).toBe("3 ГіБ");
        expect(formatCpu(1500)).toBe("1,5 vCPU");
    });
});

describe("integrity thresholds", () => {
    it("clamps every value into the server's range", () => {
        const clamped = clampThresholds({...defaults, SameAnswerWindowSeconds: 1, SameAnswerMinLength: 0, BurstAttempts: 99999, BurstWindowSeconds: Number.NaN, FastSolveGapSeconds: 2.6});
        expect(clamped).toMatchObject({SameAnswerWindowSeconds: 10, SameAnswerMinLength: 1, BurstAttempts: 1000, BurstWindowSeconds: 10, FastSolveGapSeconds: 5});
        expect(thresholdsEqual(defaults, {...defaults})).toBe(true);
        expect(thresholdsEqual(defaults, {...defaults, IncludeCorrect: true})).toBe(false);
    });

    it("remembers the thresholds per event and survives bad or blocked storage", () => {
        const store = new Map<string, string>();
        const storage = {getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key)};
        Object.defineProperty(window, "localStorage", {value: storage, configurable: true});

        expect(loadThresholds("e1")).toBeNull();
        saveThresholds("e1", {...defaults, BurstAttempts: 30});
        expect(loadThresholds("e1")?.BurstAttempts).toBe(30);
        expect(loadThresholds("e2")).toBeNull();
        saveThresholds("e1", null);
        expect(loadThresholds("e1")).toBeNull();

        store.set("event-analytics-integrity:e1", "{not json");
        expect(loadThresholds("e1")).toBeNull();
        store.set("event-analytics-integrity:e1", JSON.stringify({BurstAttempts: "x"}));
        expect(loadThresholds("e1")).toBeNull();

        Object.defineProperty(window, "localStorage", {get: () => {throw new Error("blocked");}, configurable: true});
        expect(loadThresholds("e1")).toBeNull();
        expect(() => saveThresholds("e1", defaults)).not.toThrow();
    });

    it("carries the same thresholds into the CSV export", () => {
        const path = integrityExportPath({from: null, to: null}, {...defaults, IncludeCorrect: true});
        expect(path.startsWith("analytics/integrity/export.csv?")).toBe(true);
        expect(path).toContain("includeCorrect=true");
        expect(path).toContain("burstAttempts=15");
        expect(integrityExportPath({from: null, to: null}, null)).toBe("analytics/integrity/export.csv");
    });
});

describe("the link from a signal to the attempts journal", () => {
    it("filters by task and the signal's span, widened by a minute", () => {
        const href = integrityJournalHref(signal({}));
        const params = new URL(href, "https://event.test").searchParams;
        expect(href.startsWith("/manage/submissions?")).toBe(true);
        expect(params.get("challengeId")).toBe(challenge);
        expect(params.get("teamId")).toBeNull();
        expect(params.get("from")).toBe("2026-09-29T09:59:00.000Z");
        expect(params.get("to")).toBe("2026-09-29T10:02:00.000Z");
    });

    it("also filters by team for a burst", () => {
        const params = new URL(integrityJournalHref(signal({Kind: "burst"})), "https://event.test").searchParams;
        expect(params.get("teamId")).toBe(team);
    });

    it("turns the link's parameters into the journal's filters and ignores junk", () => {
        const filters = journalFiltersFromParams({challengeId: challenge, teamId: "not-an-id", from: "2026-09-29T09:59:00.000Z", to: "garbage"});
        expect(filters.challengeID).toBe(challenge);
        expect(filters.teamID).toBeUndefined();
        expect(filters.from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
        expect(filters.to).toBeUndefined();
        expect(journalFiltersFromParams({})).toEqual({});
    });
});

describe("report activity", () => {
    const report = (points: {At: string; Attempts: number; Solves: number}[]) => ({Series: points.map(point => ({...point, Correct: 0, Opens: 0}))}) as unknown as AnalyticsReport;

    it("keeps 5-minute points for a short event", () => {
        const buckets = bucketedActivity(report([{At: "2026-09-29T10:00:00.000Z", Attempts: 1, Solves: 0}, {At: "2026-09-29T10:05:00.000Z", Attempts: 2, Solves: 1}]));
        expect(buckets.map(bucket => bucket.attempts)).toEqual([1, 2]);
    });

    it("folds a long event into hours", () => {
        const buckets = bucketedActivity(report([
            {At: "2026-09-29T00:00:00.000Z", Attempts: 1, Solves: 0}, {At: "2026-09-29T00:35:00.000Z", Attempts: 2, Solves: 1}, {At: "2026-09-29T18:00:00.000Z", Attempts: 4, Solves: 0},
        ]));
        expect(buckets).toHaveLength(2);
        expect(buckets[0]).toMatchObject({attempts: 3, solves: 1});
    });
});

