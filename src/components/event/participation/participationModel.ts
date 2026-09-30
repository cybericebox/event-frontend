import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswer, ParticipantAnswers} from "@/api/participantForm";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {t} from "@/i18n/t";
import {isFileAnswer} from "@/api/answerFiles";
import type {Participation} from "@/api/clientAuth";
import {reasonText} from "./participationRules";
import {STORAGE_TEAM_JOIN_CODE} from "@/utils/storageKeys";

export function formFields(form: ParticipantForm | null | undefined): FormField[] {
    return form?.Enabled ? form.Document.blocks.filter(isFormField) : [];
}

export function formatAnswer(value: ParticipantAnswer | unknown): string {
    if (value === undefined || value === null || value === "") return "—";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
    if (typeof value === "boolean") return value ? t("participation.answer.yes") : t("participation.answer.no");
    if (isFileAnswer(value)) return value.name;
    if (typeof value === "object") return "—";
    return String(value);
}

// The form restricted to fields the participant or captain may still change.
export function editableForm(form: ParticipantForm): ParticipantForm {
    return {...form, Required: false, Document: {blocks: form.Document.blocks.filter(block => isFormField(block) && block.editable)}};
}

// Only changed editable keys are sent; the backend keeps everything else. A
// fillable key (a required field still owed) may change once, editable or not.
export function changedEditableAnswers(form: ParticipantForm, before: ParticipantAnswers, after: ParticipantAnswers, fillable: readonly string[] = []): ParticipantAnswers {
    const changed: ParticipantAnswers = {};
    for (const field of formFields(form)) {
        if (!(field.editable || fillable.includes(field.key)) || !(field.key in after)) continue;
        if (JSON.stringify(before[field.key] ?? null) !== JSON.stringify(after[field.key] ?? null)) changed[field.key] = after[field.key];
    }
    return changed;
}

export function rosterLine(memberCount: number, max: number | null | undefined, min: number | null | undefined): string {
    const parts = [max ? t("participation.roster.ofMax", {count: memberCount, max}) : String(memberCount)];
    if (min && min > 1) parts.push(t("participation.roster.min", {min}));
    return parts.join(" · ");
}

const JOIN_PARAM = "join";

// The invitation is a link to the event's team page with the code in the query.
export function joinLink(origin: string, code: string): string {
    // Straight to the team tab; /team?join= (links shared before) still redirects there.
    return `${origin}/participation?tab=team&${JOIN_PARAM}=${encodeURIComponent(code)}`;
}

// The code from a pasted join link or a bare code; empty when there is none.
export function parseJoinCode(input: string): string {
    const text = input.trim();
    if (!text) return "";
    try {
        const code = new URL(text).searchParams.get(JOIN_PARAM);
        if (code !== null) return code.trim();
    } catch { /* not a URL: a bare code */ }
    const match = new RegExp(`[?&]${JOIN_PARAM}=([^&#\\s]+)`).exec(text);
    return match ? decodeURIComponent(match[1]).trim() : text;
}

export function joinCodeFromSearch(search: string): string {
    return new URLSearchParams(search).get(JOIN_PARAM)?.trim() ?? "";
}

// A visitor who has to register first keeps the code for the rest of the session.
export function rememberJoinCode(code: string): void {
    try { if (code) sessionStorage.setItem(STORAGE_TEAM_JOIN_CODE, code); } catch { /* storage may be blocked */ }
}

export function recalledJoinCode(): string {
    try { return sessionStorage.getItem(STORAGE_TEAM_JOIN_CODE) ?? ""; } catch { return ""; }
}

export function forgetJoinCode(): void {
    try { sessionStorage.removeItem(STORAGE_TEAM_JOIN_CODE); } catch { /* storage may be blocked */ }
}

const expiresFormat = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});

// «діє до …» for a link with an expiry, the no-limit line otherwise; an expired link says so.
export function joinLinkValidity(expiresAt: string | null, now: number): {text: string; expired: boolean} {
    if (!expiresAt) return {text: t("participation.team.link.noExpiry"), expired: false};
    const at = Date.parse(expiresAt);
    if (!Number.isFinite(at)) return {text: t("participation.team.link.noExpiry"), expired: false};
    if (at <= now) return {text: t("participation.team.link.expired", {date: expiresFormat.format(at)}), expired: true};
    return {text: t("participation.team.link.validUntil", {date: expiresFormat.format(at)}), expired: false};
}

export type ParticipationTab = "profile" | "team";

// «Команда» exists only in team mode; an unknown or foreign tab opens the profile.
export function participationTabFromParam(tab: string | null | undefined, teamMode: boolean): ParticipationTab | null {
    if (tab === "profile") return "profile";
    return tab === "team" && teamMode ? "team" : null;
}

// A captain whose team is not complete yet (below the minimum, or with unanswered invitations) lands on the team.
export function defaultParticipationTab({teamMode, captain, memberCount, minSize, pending}: {teamMode: boolean; captain: boolean; memberCount: number; minSize: number; pending: number}): ParticipationTab {
    return teamMode && captain && (memberCount < minSize || pending > 0) ? "team" : "profile";
}

export function participationTabHref(tab: ParticipationTab): string {
    return tab === "profile" ? "/participation" : `/participation?tab=${tab}`;
}

// The old /team link (also the invitation link): the team tab, with the join code kept.
export function teamRedirectHref(search: string): string {
    const params = new URLSearchParams(search);
    params.set("tab", "team");
    return `/participation?${params.toString()}`;
}

// The roster line of the invite block: the roster closes with the registration, so both lines carry that one moment.
export function rosterStatusLine(participation: Participation | null, rosterOpen: boolean): string {
    const closesAt = participation?.RegistrationClosesAt ?? null;
    const date = closesAt && Number.isFinite(Date.parse(closesAt)) ? expiresFormat.format(Date.parse(closesAt)) : "";
    if (!rosterOpen) {
        if (date) return t("participation.roster.lockedFrom", {date});
        return reasonText(participation?.RosterReason ?? "") || t("participation.roster.locked");
    }
    return date ? t("participation.roster.openUntil", {date}) : t("participation.roster.open");
}
