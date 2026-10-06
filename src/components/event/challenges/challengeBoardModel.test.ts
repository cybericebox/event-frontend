import {describe, expect, it} from "vitest";
import {challengeSchema, type OwnChallenge} from "@/api/participantChallenges";
import {
    attemptsLeft, boardViewKey, NO_SPEND, spendAttempt, buildCategories, formatFileSize, formatPoints, lockedLabel, matchesBoard, missingMembers,
    readBoardView, restPoints, solvedCount, solvesLabel, writeBoardView,
    applyBoardFilters, boardFilterSearch, boardStatus, DEFAULT_BOARD_FILTERS, parseBoardFilters, UNSTAGED,
} from "./challengeBoardModel";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function challenge(n: number, group: number, extra: Partial<OwnChallenge> = {}): OwnChallenge {
    return challengeSchema.parse({
        ID: uuid(900 + n), EventChallengeID: uuid(n), Snapshot: {name: `Task ${n}`, difficulty: "easy"},
        Readiness: 2, SolvedAt: null, Points: n * 100, Order: 10 - n, GroupID: uuid(group), GroupName: `G${group}`, GroupOrder: group,
        ...extra,
    });
}

describe("challenge board model", () => {
    it("pluralizes Ukrainian counts", () => {
        expect(solvesLabel(1)).toBe("1 рішення");
        expect(solvesLabel(22)).toBe("22 рішення");
        expect(solvesLabel(11)).toBe("11 рішень");
        expect(solvesLabel(7)).toBe("7 рішень");
    });

    it("formats points and file sizes", () => {
        expect(formatPoints(1250)).toBe("1 250");
        expect(formatFileSize(0)).toBe("");
        expect(formatFileSize(512)).toBe("512 Б");
        expect(formatFileSize(2048)).toBe("2 КБ");
        expect(formatFileSize(1_468_006)).toBe("1,4 МБ");
        expect(formatFileSize(52_428_800)).toBe("50 МБ");
    });

    it("groups by category order and keeps the organizer's task order", () => {
        const categories = buildCategories([challenge(1, 2), challenge(2, 1), challenge(3, 1)]);
        expect(categories.map(item => item.name)).toEqual(["G1", "G2"]);
        expect(categories[0].challenges.map(item => item.Snapshot.name)).toEqual(["Task 3", "Task 2"]);
    });

    it("searches names and categories", () => {
        const solved = challenge(1, 1, {SolvedAt: "2026-09-26T10:00:00Z"});
        expect(matchesBoard(solved, "nothing like it")).toBe(false);
        expect(matchesBoard(solved, "task 1")).toBe(true);
        expect(matchesBoard(challenge(2, 1), "web", "Web")).toBe(true);
        expect(matchesBoard(challenge(2, 1), "crypto", "Web")).toBe(false);
    });

    it("counts solved tasks and the points left", () => {
        const items = [challenge(1, 1, {SolvedAt: "2026-09-26T10:00:00Z"}), challenge(2, 1), challenge(3, 1)];
        expect(solvedCount(items)).toBe("1 / 3");
        expect(restPoints(items)).toBe(500);
    });

    it("names only unsolved prerequisites on a locked tile", () => {
        const locked = challenge(4, 1, {Locked: true, Prerequisites: [
            {EventChallengeID: uuid(1), Name: "SQL", Solved: true},
            {EventChallengeID: uuid(2), Name: "SSTI", Solved: false},
        ]});
        expect(lockedLabel(locked)).toBe("Відкриється після: SSTI");
    });

    it("remembers the board view per user and survives broken storage", () => {
        const store = new Map<string, string>();
        const storage = {getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value)};
        writeBoardView(storage, boardViewKey("u1"), "rail");
        expect(readBoardView(storage, boardViewKey("u1"))).toBe("rail");
        expect(readBoardView(storage, boardViewKey("u2"))).toBe("tiles");
        const broken = {getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }};
        expect(readBoardView(broken, "k")).toBe("tiles");
        expect(() => writeBoardView(broken, "k", "rail")).not.toThrow();
    });

    it("computes missing members for admission", () => {
        expect(missingMembers(1, 3)).toBe(2);
        expect(missingMembers(4, 3)).toBe(0);
        expect(missingMembers(1, null)).toBe(0);
    });
});

describe("attempts left", () => {
    const task = (left: number | null) => challenge(1, 1, {AttemptsLeft: left, MaxAttempts: left === null ? null : 5});

    it("is null when the task is unlimited or solved", () => {
        expect(attemptsLeft(task(null), spendAttempt(task(null), NO_SPEND))).toBeNull();
    });

    it("counts wrong answers made since the board was loaded and never drops below zero", () => {
        let spend = NO_SPEND;
        expect(attemptsLeft(task(2), spend)).toBe(2);
        spend = spendAttempt(task(2), spend);
        expect(attemptsLeft(task(2), spend)).toBe(1);
        spend = spendAttempt(task(2), spend);
        spend = spendAttempt(task(2), spend);
        expect(attemptsLeft(task(2), spend)).toBe(0);
    });

    it("drops the local count once the board already includes the attempts", () => {
        const spend = spendAttempt(task(2), NO_SPEND);
        expect(attemptsLeft(task(1), spend)).toBe(1);
    });

    it("keeps counts of different tasks apart and zeroes everything on a server refusal", () => {
        const first = task(2);
        const other = challenge(2, 1, {AttemptsLeft: 2, MaxAttempts: 5});
        const spend = spendAttempt(first, NO_SPEND);
        expect(attemptsLeft(other, spend)).toBe(2);
        expect(attemptsLeft(first, spendAttempt(first, NO_SPEND, true))).toBe(0);
    });
});

describe("board filters", () => {
    const open = {ID: uuid(1), Name: "Open", OpensAt: "2026-10-01T10:00:00Z", ClosesAt: "2026-10-01T12:00:00Z", Returnable: false, State: "open" as const};
    const closed = {ID: uuid(2), Name: "Closed", OpensAt: "2026-10-01T08:00:00Z", ClosesAt: "2026-10-01T10:00:00Z", Returnable: true, State: "closed" as const};
    const stages = [closed, open];
    const unstaged = challenge(1, 1);
    const inOpen = challenge(2, 1, {StageID: open.ID});
    const inClosed = challenge(3, 1, {StageID: closed.ID, Closed: true});
    const solvedInClosed = challenge(4, 1, {StageID: closed.ID, Closed: true, SolvedAt: "2026-10-01T09:00:00Z"});
    const practice = challenge(5, 1, {StageID: closed.ID, Practice: true});
    const all = [unstaged, inOpen, inClosed, solvedInClosed, practice];

    it("defaults to «Відкриті»: unsolved tasks that are not closed, whatever their stage", () => {
        expect(DEFAULT_BOARD_FILTERS.status).toBe("open");
        expect(applyBoardFilters(all, DEFAULT_BOARD_FILTERS, stages)).toEqual([unstaged, inOpen]);
        expect(applyBoardFilters(all, {...DEFAULT_BOARD_FILTERS, status: ""})).toEqual(all);
    });

    it("«Відкриті» means can be solved now: no locked tasks, no tasks of a stage that is closed or not open yet", () => {
        const locked = challenge(7, 1, {Locked: true});
        const future = challenge(8, 1, {StageID: uuid(99)});
        const returnable = challenge(9, 1, {StageID: closed.ID});
        const pool = [unstaged, inOpen, locked, future, returnable];
        expect(applyBoardFilters(pool, DEFAULT_BOARD_FILTERS, stages)).toEqual([unstaged, inOpen]);
        expect(applyBoardFilters(pool, {...DEFAULT_BOARD_FILTERS, status: ""}, stages)).toEqual(pool);
        expect(applyBoardFilters(pool, {...DEFAULT_BOARD_FILTERS, status: "closed"}, stages)).toEqual([returnable]);
    });

    it("narrows by stage, including the sets without one", () => {
        const wide = {...DEFAULT_BOARD_FILTERS, status: "" as const};
        expect(applyBoardFilters(all, {...wide, stage: closed.ID})).toEqual([inClosed, solvedInClosed, practice]);
        expect(applyBoardFilters(all, {...wide, stage: UNSTAGED})).toEqual([unstaged]);
    });

    it("status: solved is the team's (any lock, a practice solve too), closed is locked and unsolved, open is the rest", () => {
        expect(boardStatus(unstaged)).toBe("open");
        expect(boardStatus(inClosed)).toBe("closed");
        expect(boardStatus(solvedInClosed)).toBe("solved");
        expect(boardStatus(practice)).toBe("solved");
        const wide = {...DEFAULT_BOARD_FILTERS, status: "" as const};
        expect(applyBoardFilters(all, {...wide, status: "solved"})).toEqual([solvedInClosed, practice]);
        expect(applyBoardFilters(all, {...wide, status: "closed"})).toEqual([inClosed]);
        expect(applyBoardFilters(all, {...wide, status: "open"}, stages)).toEqual([unstaged, inOpen]);
    });

    it("groups with no visible task vanish: categories are built from the filtered tasks", () => {
        const other = challenge(6, 2, {StageID: closed.ID, Closed: true});
        const shown = buildCategories(applyBoardFilters([unstaged, other], DEFAULT_BOARD_FILTERS));
        expect(shown.map(group => group.name)).toEqual(["G1"]);
    });

    it("keeps the filters in the URL and leaves the defaults and other parameters alone", () => {
        expect(parseBoardFilters("")).toEqual(DEFAULT_BOARD_FILTERS);
        const filters = {stage: closed.ID, status: "closed" as const, category: uuid(7)};
        const search = boardFilterSearch("?x=1", filters);
        expect(parseBoardFilters(search)).toEqual(filters);
        expect(search).toContain("x=1");
        expect(boardFilterSearch("?x=1&scope=all&status=open", DEFAULT_BOARD_FILTERS)).toBe("?x=1");
        expect(boardFilterSearch("", {...DEFAULT_BOARD_FILTERS, status: ""})).toBe("?status=all");
        expect(parseBoardFilters("?status=all")).toEqual({...DEFAULT_BOARD_FILTERS, status: ""});
        expect(parseBoardFilters("?status=bogus&scope=nope")).toEqual(DEFAULT_BOARD_FILTERS);
    });
});
