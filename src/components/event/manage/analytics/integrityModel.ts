import type {IntegrityFlag, IntegrityLevel, IntegritySignal} from "@/api/manageAnalyticsIntegrity";
import {integrityKinds} from "@/api/manageAnalyticsIntegrity";
import {t} from "@/i18n/t";
import {formatDateTime, formatDuration, noValue} from "./analyticsFormat";

// Pure helpers of «Доброчесність»: kind labels, the one-sentence evidence of a
// signal and the journal marker. Neutral wording: hints to review, not verdicts.

export const integrityKey = (eventID: string) => ["event-analytics-integrity", eventID] as const;
export const integrityFlagsKey = (eventID: string) => ["event-analytics-integrity-flags", eventID] as const;
export const integrityDismissalsKey = (eventID: string) => ["event-analytics-integrity-dismissals", eventID] as const;

export const kindLabel = (kind: string) => (integrityKinds as readonly string[]).includes(kind) ? t(`manage.analytics.integrity.kind.${kind}`) : kind;

// The participant-facing level name of the task board («Легке», «Розминка»).
export const levelLabel = (level: IntegrityLevel) => t(`challenges.difficulty.${level}`);

// The precise reason of a kind, one short phrase (chip titles, journal tooltip).
export const kindReason = (kind: string) => (integrityKinds as readonly string[]).includes(kind) ? t(`manage.analytics.integrity.reason.${kind}`) : kind;

const clock = new Intl.DateTimeFormat("uk-UA", {hour: "2-digit", minute: "2-digit", second: "2-digit"});
export const formatClock = (iso: string) => clock.format(new Date(iso));

const teamNames = (signal: IntegritySignal) => signal.Teams.map(team => team.Name).join(", ") || noValue;

// One short human sentence per signal. `level` is the solve's task level, used
// by the floor sentence of too_fast (the signal carries the floor as Baseline).
export function signalEvidence(signal: IntegritySignal, level: IntegrityLevel): string {
    switch (signal.Kind) {
        case "no_access": return t("manage.analytics.integrity.evidence.no_access");
        case "no_lab": return signal.Extra === 1 ? t("manage.analytics.integrity.evidence.no_lab_knock", {time: formatDateTime(signal.At)}) : t("manage.analytics.integrity.evidence.no_lab");
        case "too_fast": return t("manage.analytics.integrity.evidence.too_fast", {time: formatDuration(signal.Seconds), level: levelLabel(level), floor: formatDuration(signal.Baseline)});
        case "first_try_hard": return t("manage.analytics.integrity.evidence.first_try_hard", {teams: signal.Count, attempts: signal.Baseline});
        case "shared_wrong": return t(signal.Answers.length > 0 ? "manage.analytics.integrity.evidence.shared_wrong" : "manage.analytics.integrity.evidence.shared_wrong_teams", {count: signal.Count, teams: teamNames(signal)});
        case "cross_flag": return t(signal.Owner?.SameTask ? "manage.analytics.integrity.evidence.cross_flag_same" : "manage.analytics.integrity.evidence.cross_flag", {team: signal.Owner?.TeamName ?? noValue, task: signal.Owner?.ChallengeName ?? noValue, count: signal.Count, time: formatDateTime(signal.At)});
        case "burst": return t("manage.analytics.integrity.evidence.burst", {count: signal.Count, window: formatDuration(signal.Seconds), gap: formatDuration(signal.Baseline)});
        case "brute_force": return t("manage.analytics.integrity.evidence.brute_force", {count: signal.Count, window: formatDuration(signal.Seconds), rejected: signal.Extra});
        case "follows_solve": return t("manage.analytics.integrity.evidence.follows_solve", {gap: formatDuration(signal.Seconds), team: teamNames(signal), attempts: signal.Count});
    }
}

// Flags of the attempts journal by solve: team + task, and the solve id itself.
export type FlagIndex = {byPair: Map<string, IntegrityFlag>; byID: Map<string, IntegrityFlag>};
export const emptyFlagIndex = (): FlagIndex => ({byPair: new Map(), byID: new Map()});

export function indexFlags(flags: IntegrityFlag[]): FlagIndex {
    const index = emptyFlagIndex();
    for (const flag of flags) {
        index.byPair.set(`${flag.TeamID}:${flag.ChallengeID}`, flag);
        index.byID.set(flag.TeamChallengeID, flag);
    }
    return index;
}

type FlagAttempt = {EventTeamID: string; EventChallengeID: string; TeamChallengeID: string; Correct: boolean; ReceivedAt: string};

export function flagOf(index: FlagIndex, attempt: Pick<FlagAttempt, "EventTeamID" | "EventChallengeID" | "TeamChallengeID">): IntegrityFlag | null {
    return index.byID.get(attempt.TeamChallengeID) ?? index.byPair.get(`${attempt.EventTeamID}:${attempt.EventChallengeID}`) ?? null;
}

// What the journal marks on an attempt: the correct attempt of a flagged solve
// (every kind of the flag), or the very submission of another team's flag, even
// when incorrect (cross_flag only). Kinds only: no names, no answers.
export function attemptMarker(index: FlagIndex, attempt: FlagAttempt): {flag: IntegrityFlag; kinds: string[]} | null {
    const flag = flagOf(index, attempt);
    if (!flag) return null;
    const received = Date.parse(attempt.ReceivedAt);
    if (attempt.Correct) return {flag, kinds: flag.Signals};
    return flag.CrossFlagTimes.some(time => Date.parse(time) === received) ? {flag, kinds: ["cross_flag"]} : null;
}

export const markerTooltip = (kinds: string[]) => t("manage.analytics.integrity.marker.tooltip", {kinds: kinds.map(kindReason).join("; ")});
