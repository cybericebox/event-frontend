import type {OwnChallenge} from "@/api/participantChallenges";
import {t, tPlural} from "@/i18n/t";

export type BoardView = "tiles" | "rail";
export type BoardFilter = "all" | "open";
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

export function matchesBoard(challenge: OwnChallenge, filter: BoardFilter, query: string, categoryName = ""): boolean {
    if (filter === "open" && challenge.SolvedAt) return false;
    const q = query.trim().toLocaleLowerCase("uk");
    return !q || challenge.Snapshot.name.toLocaleLowerCase("uk").includes(q) || categoryName.toLocaleLowerCase("uk").includes(q);
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
