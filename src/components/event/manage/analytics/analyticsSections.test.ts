// @vitest-environment jsdom
import {describe, expect, it} from "vitest";
import {clampThresholds, defaultIntegrityFilters, integrityExportPath, integrityJournalHref, integrityKinds, integrityPageHref, integrityQuery, thresholdsEqual, type IntegritySignal, type IntegrityThresholds} from "@/api/manageAnalyticsIntegrity";
import type {AnalyticsReport} from "@/api/manageAnalyticsReport";
import {journalFiltersFromParams} from "../journalViews";
import {formatBytes, formatCpu, formatDuration, noValue} from "./analyticsFormat";
import {emptyFlagIndex, attemptMarker, flagOf, indexFlags, kindLabel, kindReason, levelLabel, markerTooltip, signalEvidence} from "./integrityModel";
import {loadThresholds, saveThresholds} from "./integrityThresholds";
import {bucketedActivity} from "./reportCharts";

const defaults: IntegrityThresholds = {FloorSeconds: {elementary: 0, trivial: 5, easy: 20, medium: 60, hard: 120, insane: 240}, BruteForceAttempts: 15, BruteForceWindowSeconds: 60, FollowGapSeconds: 30};
const challenge = "01a0d498-32b3-7a38-8355-30cc209f56ab";
const team = "0190c6a4-0000-7000-8000-000000000001";

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
        const clamped = clampThresholds({FloorSeconds: {...defaults.FloorSeconds, elementary: -5, insane: 99999, easy: 20.4}, BruteForceAttempts: 1, BruteForceWindowSeconds: Number.NaN, FollowGapSeconds: 2.6});
        expect(clamped.FloorSeconds).toMatchObject({elementary: 0, insane: 3600, easy: 20});
        expect(clamped).toMatchObject({BruteForceAttempts: 3, BruteForceWindowSeconds: 10, FollowGapSeconds: 5});
        expect(thresholdsEqual(defaults, {...defaults, FloorSeconds: {...defaults.FloorSeconds}})).toBe(true);
        expect(thresholdsEqual(defaults, {...defaults, FloorSeconds: {...defaults.FloorSeconds, medium: 61}})).toBe(false);
        expect(thresholdsEqual(defaults, {...defaults, FollowGapSeconds: 31})).toBe(false);
    });

    it("remembers the thresholds per event and survives bad or blocked storage", () => {
        const store = new Map<string, string>();
        const storage = {getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key)};
        Object.defineProperty(window, "localStorage", {value: storage, configurable: true});

        expect(loadThresholds("e1")).toBeNull();
        saveThresholds("e1", {...defaults, BruteForceAttempts: 30});
        expect(loadThresholds("e1")?.BruteForceAttempts).toBe(30);
        expect(loadThresholds("e2")).toBeNull();
        saveThresholds("e1", null);
        expect(loadThresholds("e1")).toBeNull();

        const key = "cib_integrity_thresholds_e1";
        store.set(key, "{not json");
        expect(loadThresholds("e1")).toBeNull();
        store.set(key, JSON.stringify({BruteForceAttempts: "x"}));
        expect(loadThresholds("e1")).toBeNull();
        store.set(key, JSON.stringify({...defaults, FloorSeconds: {trivial: 5}}));
        expect(loadThresholds("e1")).toBeNull();

        Object.defineProperty(window, "localStorage", {get: () => {throw new Error("blocked");}, configurable: true});
        expect(loadThresholds("e1")).toBeNull();
        expect(() => saveThresholds("e1", defaults)).not.toThrow();
    });
});

describe("the integrity query", () => {
    const whole = {from: null, to: null};

    it("sends the default view (unreviewed, server thresholds) and nothing else", () => {
        expect(integrityQuery(whole, defaultIntegrityFilters, null)).toBe("?reviewed=no");
        expect(integrityQuery(whole, {...defaultIntegrityFilters, reviewed: "all"}, null)).toBe("");
    });

    it("carries the period, filters and every threshold", () => {
        const params = new URLSearchParams(integrityQuery({from: "2026-09-29T10:00:00.000Z", to: "2026-09-29T12:00:00.000Z"}, {signal: "burst", teamID: team, challengeID: challenge, reviewed: "yes"}, {...defaults, FloorSeconds: {...defaults.FloorSeconds, medium: 90}}));
        expect(Object.fromEntries(params)).toEqual({
            from: "2026-09-29T10:00:00.000Z", to: "2026-09-29T12:00:00.000Z", signal: "burst", teamId: team, challengeId: challenge, reviewed: "yes",
            floorElementary: "0", floorTrivial: "5", floorEasy: "20", floorMedium: "90", floorHard: "120", floorInsane: "240",
            bruteForceAttempts: "15", bruteForceWindow: "60", followGap: "30",
        });
    });

    it("gives the CSV export the same query", () => {
        const filters = {...defaultIntegrityFilters, signal: "too_fast" as const};
        expect(integrityExportPath({from: null, to: null}, filters, null)).toBe("analytics/integrity/export.csv?signal=too_fast&reviewed=no");
    });
});

describe("the links from a flagged solve", () => {
    it("opens the attempts journal on the team and task", () => {
        const href = integrityJournalHref({TeamID: team, ChallengeID: challenge});
        const params = new URL(href, "https://event.test").searchParams;
        expect(href.startsWith("/manage/submissions?")).toBe(true);
        expect(params.get("tab")).toBe("attempts");
        expect(params.get("challengeId")).toBe(challenge);
        expect(params.get("teamId")).toBe(team);
    });

    it("opens the integrity page on the team and task", () => {
        const href = integrityPageHref({TeamID: team, ChallengeID: challenge});
        const params = new URL(href, "https://event.test").searchParams;
        expect(href.startsWith("/manage/analytics/integrity?")).toBe(true);
        expect(params.get("teamId")).toBe(team);
        expect(params.get("challengeId")).toBe(challenge);
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

describe("signal evidence", () => {
    const base = {Count: 0, Extra: 0, Seconds: 0, Baseline: 0, Teams: [], Info: false, Answers: [], Owner: null, At: null};
    const sig = (extra: Partial<IntegritySignal> & {Kind: IntegritySignal["Kind"]}): IntegritySignal => ({...base, ...extra} as IntegritySignal);

    it("writes one sentence per kind, with formatted durations", () => {
        expect(signalEvidence(sig({Kind: "no_access"}), "easy")).toBe("Команда не відкривала завдання, не завантажувала його файли й не брала підказок до розв'язання.");
        expect(signalEvidence(sig({Kind: "no_lab"}), "easy")).toBe("Розв'язано завдання з лабораторією, але команда жодного разу не підключала VPN.");
        expect(signalEvidence(sig({Kind: "no_lab", Extra: 1, At: "2026-09-29T10:00:00.000Z"}), "easy")).toMatch(/^Клієнт VPN команди стукався до лабораторії \(.+\), але лабораторія не відповіла жодного разу до розв'язання\.$/);
        expect(signalEvidence(sig({Kind: "too_fast", Seconds: 3, Baseline: 20}), "easy")).toBe("Здано через 3 с після першого відкриття завдання (поріг для рівня «Легке» — 20 с).");
        expect(signalEvidence(sig({Kind: "first_try_hard", Count: 8, Baseline: 5}), "hard")).toBe("Розв'язано з першої спроби. Медіана спроб серед команд, що розв'язали завдання (8): 5.");
        expect(signalEvidence(sig({Kind: "shared_wrong", Count: 2, Teams: [{ID: "a", Name: "Red"}, {ID: "b", Name: "Green"}]}), "medium")).toBe("Неправильні відповіді цієї команди збігаються з відповідями інших команд (2). Команди: Red, Green.");
        expect(signalEvidence(sig({Kind: "shared_wrong", Count: 2, Answers: [{Value: "flag{x}", Order: []}]}), "medium")).toBe("Неправильні відповіді цієї команди збігаються з відповідями інших команд: 2.");
        const owner = {TeamID: "a", TeamName: "Red", ChallengeID: "c", ChallengeName: "Web 2", SameTask: false};
        expect(signalEvidence(sig({Kind: "cross_flag", Count: 3, Owner: owner, At: "2026-09-29T10:00:00.000Z"}), "medium")).toMatch(/^Надіслала прапор іншої команди «Red» \(завдання «Web 2»\); разів: 3, востаннє .+\.$/);
        expect(signalEvidence(sig({Kind: "cross_flag", Count: 1, Owner: {...owner, SameTask: true}, At: "2026-09-29T10:00:00.000Z"}), "medium")).toMatch(/^Надіслала прапор іншої команди «Red» того самого завдання; разів: 1, востаннє .+\.$/);
        expect(signalEvidence(sig({Kind: "burst", Count: 4, Seconds: 120, Baseline: 95}), "medium")).toBe("4 розв'язань за 2 хв; типовий проміжок між розв'язаннями цієї команди — 1 хв 35 с.");
        expect(signalEvidence(sig({Kind: "brute_force", Count: 40, Extra: 6, Seconds: 60}), "medium")).toBe("40 спроб за 1 хв, відхилено за частотою: 6.");
        expect(signalEvidence(sig({Kind: "follows_solve", Seconds: 45, Count: 1, Teams: [{ID: "a", Name: "Red"}]}), "medium")).toBe("Здано через 45 с після команди «Red»; власних спроб до цього: 1.");
    });

    it("names the elementary level and every kind in English catalog keys too", () => {
        expect(levelLabel("elementary")).toBe("Елементарне");
        expect(signalEvidence(sig({Kind: "too_fast", Seconds: 1, Baseline: 5}), "elementary")).toContain("«Елементарне»");
        for (const kind of integrityKinds) expect(kindLabel(kind)).not.toContain("manage.analytics.integrity.kind");
    });
});

describe("journal flags", () => {
    const flag = {TeamChallengeID: "tc1", TeamID: team, ChallengeID: challenge, Count: 2, Signals: ["too_fast", "burst"], CrossFlagTimes: ["2026-09-29T10:00:00.500Z"]};
    const ids = {EventTeamID: team, EventChallengeID: challenge, TeamChallengeID: "tc1"};
    const attempt = {...ids, Correct: true, ReceivedAt: "2026-09-29T10:05:00.000Z"};

    it("finds a flag by solve id or by team and task", () => {
        const index = indexFlags([flag]);
        expect(flagOf(index, attempt)).toBe(flag);
        expect(flagOf(index, {...attempt, TeamChallengeID: "other"})).toBe(flag);
        expect(flagOf(index, {...attempt, EventChallengeID: "0190c6a4-0000-7000-8000-0000000000bb", TeamChallengeID: "other"})).toBeNull();
        expect(flagOf(emptyFlagIndex(), attempt)).toBeNull();
    });

    it("marks the correct attempt with every kind of the flag", () => {
        expect(attemptMarker(indexFlags([flag]), attempt)?.kinds).toEqual(["too_fast", "burst"]);
    });

    it("marks an incorrect attempt only when it is a submission of another team's flag", () => {
        const index = indexFlags([flag]);
        expect(attemptMarker(index, {...attempt, Correct: false})).toBeNull();
        expect(attemptMarker(index, {...attempt, Correct: false, ReceivedAt: "2026-09-29T10:00:00.500Z"})?.kinds).toEqual(["cross_flag"]);
        expect(attemptMarker(emptyFlagIndex(), {...attempt, Correct: false, ReceivedAt: "2026-09-29T10:00:00.500Z"})).toBeNull();
    });

    it("gives the precise reason per kind in the tooltip", () => {
        expect(markerTooltip(["too_fast", "burst"])).toBe("Є підозрілі сигнали для цього розв'язку: Розв'язано швидше за поріг рівня складності; Кілька розв'язань за дуже короткий час");
        expect(markerTooltip(["cross_flag"])).toBe("Є підозрілі сигнали для цього розв'язку: Надіслано прапор іншої команди");
        for (const kind of integrityKinds) expect(kindReason(kind)).not.toContain("manage.analytics.integrity.reason");
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

