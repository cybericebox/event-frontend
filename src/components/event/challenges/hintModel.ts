import {ApiErrorCode} from "@/api/apiErrors";
import {ParticipantChallengeError, type ChallengeHint, type HintLevel} from "@/api/participantChallenges";
import {t, tPlural} from "@/i18n/t";

export type HintChargeMode = "reward" | "balance";

export function pointsLabel(points: number): string {
    return tPlural("challenges.points", points);
}

export function hintLevelLabel(level: HintLevel): string {
    return t(`challenges.hint.level.${level}`);
}

type HintNode = Record<string, unknown>;
const asHintNode = (value: unknown): HintNode | null => value && typeof value === "object" && !Array.isArray(value) ? value as HintNode : null;

// A hint text is a serialized rich-text document; older exercises stored
// plain text. Returns the document, or null for plain text.
export function hintDocument(text: string): HintNode | null {
    if (!text.trimStart().startsWith("{")) return null;
    try {
        const parsed = asHintNode(JSON.parse(text));
        return asHintNode(parsed?.root)?.type === "root" ? parsed : null;
    } catch {
        return null;
    }
}

// One-line excerpt of a hint text (the organizer's price list).
export function hintPlainText(text: string): string {
    const document = hintDocument(text);
    if (!document) return text.trim();
    const parts: string[] = [];
    const walk = (value: unknown) => {
        if (Array.isArray(value)) { value.forEach(walk); return; }
        const node = asHintNode(value);
        if (!node) return;
        if (node.type === "text" && typeof node.text === "string") parts.push(node.text);
        else if (node.type === "variable" && typeof node.varName === "string") parts.push(node.varName);
        else if (node.type === "linebreak") parts.push(" ");
        walk(node.children);
        // Blocks read as separate phrases; inline links do not.
        if (Array.isArray(node.children) && node.type !== "link") parts.push(" ");
    };
    walk(document.root);
    return parts.join("").replace(/\s+/g, " ").trim();
}

// «−30 балів» or «безкоштовно».
export function hintCostLabel(cost: number): string {
    return cost > 0 ? t("challenges.hint.cost", {points: pointsLabel(cost)}) : t("challenges.hint.free");
}

// A paid hint asks first; a free one opens straight away.
export function hintNeedsConfirm(hint: Pick<ChallengeHint, "Cost" | "Unlocked">): boolean {
    return !hint.Unlocked && hint.Cost > 0;
}

// What the unlock does to the team's score, per the event's charge mode.
export function hintConfirmText(mode: HintChargeMode, cost: number): string {
    return mode === "balance"
        ? t("challenges.hint.confirmBalance", {points: pointsLabel(cost)})
        : t("challenges.hint.confirmReward", {points: pointsLabel(cost)});
}

export function hintModeNote(mode: HintChargeMode): string {
    return mode === "balance" ? t("challenges.hint.modeBalance") : t("challenges.hint.modeReward");
}

export function hintUnlockError(error: unknown): string {
    if (error instanceof ParticipantChallengeError) {
        if (error.code === ApiErrorCode.HintsDisabled) return t("challenges.hint.error.disabled");
        if (error.code === ApiErrorCode.HintNotFound) return t("challenges.hint.error.notFound");
        if (error.code === ApiErrorCode.ChallengeNotFound) return t("challenges.hint.error.challengeGone");
        if (error.code === ApiErrorCode.ChallengePrerequisites) return t("challenges.hint.error.prerequisites");
        if (error.code === ApiErrorCode.TeamNotAdmitted) return t("challenges.hint.error.notAdmitted");
        if (error.status === 409 || error.status === 403) return t("challenges.hint.error.unavailable");
    }
    return t("challenges.hint.error.failed");
}
