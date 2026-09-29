import {describe, expect, it} from "vitest";
import {challengeSchema, type OwnChallenge} from "@/api/participantChallenges";
import {
    boardViewKey, buildCategories, formatFileSize, formatPoints, lockedLabel, matchesBoard, missingMembers,
    readBoardView, restPoints, solvedCount, solvesLabel, writeBoardView,
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

    it("filters unsolved and searches names and categories", () => {
        const solved = challenge(1, 1, {SolvedAt: "2026-09-26T10:00:00Z"});
        expect(matchesBoard(solved, "open", "")).toBe(false);
        expect(matchesBoard(solved, "all", "task 1")).toBe(true);
        expect(matchesBoard(challenge(2, 1), "all", "web", "Web")).toBe(true);
        expect(matchesBoard(challenge(2, 1), "all", "crypto", "Web")).toBe(false);
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
