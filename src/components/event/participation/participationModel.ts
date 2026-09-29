import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswer, ParticipantAnswers} from "@/api/participantForm";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {t} from "@/i18n/t";
import {isFileAnswer} from "@/api/answerFiles";

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

// Only changed editable keys are sent; the backend keeps everything else.
export function changedEditableAnswers(form: ParticipantForm, before: ParticipantAnswers, after: ParticipantAnswers): ParticipantAnswers {
    const changed: ParticipantAnswers = {};
    for (const field of formFields(form)) {
        if (!field.editable || !(field.key in after)) continue;
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
const JOIN_CODE_KEY = "event-team-join-code";

// The invitation is a link to the event's team page with the code in the query.
export function joinLink(origin: string, code: string): string {
    return `${origin}/team?${JOIN_PARAM}=${encodeURIComponent(code)}`;
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
    try { if (code) sessionStorage.setItem(JOIN_CODE_KEY, code); } catch { /* storage may be blocked */ }
}

export function recalledJoinCode(): string {
    try { return sessionStorage.getItem(JOIN_CODE_KEY) ?? ""; } catch { return ""; }
}

export function forgetJoinCode(): void {
    try { sessionStorage.removeItem(JOIN_CODE_KEY); } catch { /* storage may be blocked */ }
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
