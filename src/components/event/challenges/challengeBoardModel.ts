import type {BoardStage, OwnChallenge} from "@/api/participantChallenges";
import {t, tPlural} from "@/i18n/t";

export type BoardView = "tiles" | "rail";
// "" is «Усі» and the default, so a task that was just solved stays on the board; «Відкриті» narrows it. Tasks of closed stages are reached through «Закриті».
export type BoardStatus = "" | "open" | "solved" | "closed";
export type BoardFilters = {stage: string; status: BoardStatus; category: string};
export const UNSTAGED = "none";
export const DEFAULT_BOARD_FILTERS: BoardFilters = {stage: "", status: "", category: ""};
export type BoardCategory = {key: string; name: string; order: number; challenges: OwnChallenge[]};

// «1 250» — a narrow no-break space groups thousands like the DS boards.
export function formatPoints(value: number): string {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatFileSize(bytes: number): string {
    if (!bytes || bytes < 0) return "";
    if (bytes < 1024) return t("challenges.size.bytes", {value: bytes});
    const units = ["challenges.size.kb", "challenges.size.mb", "challenges.size.gb"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return t(units[unit], {value: String(rounded).replace(".", ",")});
}

export function formatClock(iso: string, seconds = false): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("uk-UA", {hour: "2-digit", minute: "2-digit", ...(seconds ? {second: "2-digit"} : {}), hour12: false});
}

export function difficultyLabel(difficulty: OwnChallenge["Snapshot"]["difficulty"]): string {
    return t(`challenges.difficulty.${difficulty}`);
}

export function solvesLabel(n: number): string {
    return tPlural("challenges.solves", n);
}

// Categories keep the organizer's group order; tasks keep the organizer's order.
export function buildCategories(challenges: OwnChallenge[]): BoardCategory[] {
    const groups = new Map<string, BoardCategory>();
    for (const challenge of challenges) {
        const key = challenge.GroupID ?? "ungrouped";
        if (!groups.has(key)) groups.set(key, {key, name: challenge.GroupName || t("challenges.otherCategory"), order: challenge.GroupOrder, challenges: []});
        groups.get(key)!.challenges.push(challenge);
    }
    return Array.from(groups.values())
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "uk"))
        .map(group => ({...group, challenges: [...group.challenges].sort((a, b) => a.Order - b.Order || a.Snapshot.name.localeCompare(b.Snapshot.name, "uk"))}));
}

export function matchesBoard(challenge: OwnChallenge, query: string, categoryName = ""): boolean {
    const q = query.trim().toLocaleLowerCase("uk");
    return !q || challenge.Snapshot.name.toLocaleLowerCase("uk").includes(q) || categoryName.toLocaleLowerCase("uk").includes(q);
}

// What the team has done with a task, whatever its stage says: solved counts a practice solve too (it is shown as
// solved, only the rating ignores it); closed is a task of a closed stage that is not solved; the rest is open.
export function boardStatus(challenge: OwnChallenge, stages: BoardStage[] = []): Exclude<BoardStatus, ""> {
    if (challenge.SolvedAt || challenge.Practice) return "solved";
    return challenge.Closed || stageOf(challenge, stages)?.State === "closed" ? "closed" : "open";
}

const stageOf = (challenge: OwnChallenge, stages: BoardStage[]) => challenge.StageID ? stages.find(stage => stage.ID === challenge.StageID) : undefined;

// «Відкриті» = can be solved now: not solved, not locked by an unmet prerequisite, and its stage (if any) is open. A stage the
// board does not list yet has not opened.
export function isSolvableNow(challenge: OwnChallenge, stages: BoardStage[]): boolean {
    if (challenge.SolvedAt || challenge.Practice || challenge.Closed || challenge.Locked) return false;
    return !challenge.StageID || stageOf(challenge, stages)?.State === "open";
}

// Applies the stage and status filters (the category and the search narrow further inside a board).
export function applyBoardFilters(challenges: OwnChallenge[], filters: BoardFilters, stages: BoardStage[] = []): OwnChallenge[] {
    return challenges.filter(challenge => {
        if (filters.stage && (filters.stage === UNSTAGED ? challenge.StageID !== null : challenge.StageID !== filters.stage)) return false;
        if (filters.status === "open") return isSolvableNow(challenge, stages);
        return !filters.status || boardStatus(challenge, stages) === filters.status;
    });
}

const STATUSES: BoardStatus[] = ["open", "solved", "closed"];

// The filters live in the URL: ?stage=…&status=…&category=… (the default «Усі» is left out).
export function parseBoardFilters(search: string): BoardFilters {
    const params = new URLSearchParams(search);
    const status = params.get("status");
    return {
        stage: params.get("stage") ?? "",
        status: STATUSES.includes(status as BoardStatus) ? status as BoardStatus : "",
        category: params.get("category") ?? "",
    };
}

// Rewrites only the filter parameters of a query string, keeping any other.
export function boardFilterSearch(search: string, filters: BoardFilters): string {
    const params = new URLSearchParams(search);
    for (const key of ["scope", "stage", "status", "category"]) params.delete(key);
    if (filters.stage) params.set("stage", filters.stage);
    if (filters.status !== DEFAULT_BOARD_FILTERS.status) params.set("status", filters.status);
    if (filters.category) params.set("category", filters.category);
    const query = params.toString();
    return query ? `?${query}` : "";
}

// A correct answer turns the task solved on the cached board at once; the refetch that follows reconciles with the server.
export function markSolved(challenges: OwnChallenge[], id: string, at: string): OwnChallenge[] {
    return challenges.map(item => item.EventChallengeID === id && !item.SolvedAt ? {...item, SolvedAt: at, AttemptsLeft: null} : item);
}

export function awardedPoints(challenge: Pick<OwnChallenge, "Points" | "AwardedPoints">): number {
    return challenge.AwardedPoints ?? challenge.Points;
}

export function solvedCount(challenges: OwnChallenge[]): string {
    return `${challenges.filter(item => item.SolvedAt).length} / ${challenges.length}`;
}

export function restPoints(challenges: OwnChallenge[]): number {
    return challenges.filter(item => !item.SolvedAt).reduce((sum, item) => sum + item.Points, 0);
}

export function lockedLabel(challenge: OwnChallenge): string {
    const names = challenge.Prerequisites.filter(item => !item.Solved).map(item => item.Name);
    return names.length ? t("challenges.locked.after", {names: names.join(", ")}) : t("challenges.locked.later");
}

export {boardViewKey} from "@/utils/storageKeys";

// Storage can be unavailable (private mode, blocked site data): fall back to «Плитки».
export function readBoardView(storage: Pick<Storage, "getItem"> | undefined, key: string): BoardView {
    try {
        return storage?.getItem(key) === "rail" ? "rail" : "tiles";
    } catch {
        return "tiles";
    }
}

export function writeBoardView(storage: Pick<Storage, "setItem"> | undefined, key: string, view: BoardView): void {
    try {
        storage?.setItem(key, view);
    } catch {
        // The choice then lasts for this visit only.
    }
}

// «Команду не допущено: потрібно ще N учасників».
export function missingMembers(memberCount: number, minTeamSize: number | null | undefined): number {
    return Math.max(0, (minTeamSize ?? 0) - memberCount);
}

// Wrong answers sent in this modal that the board data does not include yet: keyed by the task and the server's
// count they were made against, so a refetch (which already counts them) discards them.
export type AttemptSpend = {key: string; count: number};
export const NO_SPEND: AttemptSpend = {key: "", count: 0};
const spendKey = (challenge: Pick<OwnChallenge, "EventChallengeID" | "AttemptsLeft">) => `${challenge.EventChallengeID}:${challenge.AttemptsLeft}`;

// Attempts the team has left on a task; null when unlimited or solved.
export function attemptsLeft(challenge: Pick<OwnChallenge, "EventChallengeID" | "AttemptsLeft">, spend: AttemptSpend): number | null {
    if (challenge.AttemptsLeft === null) return null;
    return Math.max(0, challenge.AttemptsLeft - (spend.key === spendKey(challenge) ? spend.count : 0));
}

// Counts one more wrong answer; `all` marks every remaining attempt as gone (the server refused the limit).
export function spendAttempt(challenge: Pick<OwnChallenge, "EventChallengeID" | "AttemptsLeft">, spend: AttemptSpend, all = false): AttemptSpend {
    if (challenge.AttemptsLeft === null) return spend;
    const key = spendKey(challenge);
    return {key, count: all ? challenge.AttemptsLeft : (spend.key === key ? spend.count : 0) + 1};
}
