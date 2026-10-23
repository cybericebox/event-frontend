import type {BroadcastAudience, BroadcastChannel, BroadcastInput, EventAudienceKind, Broadcast} from "@/api/manageBroadcasts";
import type {BroadcastTemplateInput, BroadcastTemplateRecord} from "@/api/manageBroadcastTemplates";
import type {ManageEmailTemplateInput} from "@/api/manageEmailTemplates";
import type {ManageInAppTemplateInput} from "@/api/manageNotifications";
import {t} from "@/i18n/t";
import {emailRichText} from "../emailBlocks";
import {defaultBlockForType, type EmailBodyBlock} from "../notifications/editor/emailBlocks";
import type {VariableDef} from "../notifications/editor/variableUtils";

// The only variables a broadcast provides.
export const broadcastVariableNames = ["user_name", "user_first_name", "user_last_name", "user_email", "event_name", "event_url"] as const;

export function broadcastVariables(): VariableDef[] {
    return broadcastVariableNames.map(name => ({name, description: t(`manage.broadcasts.variable.${name}`), example: t(`manage.broadcasts.sample.${name}`)}));
}

// Sample values of the variables for the in-app preview: the event's own name and site (this page runs on it), the
// recipient as a placeholder, like the email preview of the server.
export function broadcastSampleValues(eventName: string): Record<string, string> {
    const site = typeof window === "undefined" ? null : window.location;
    return {
        ...Object.fromEntries(broadcastVariableNames.map(name => [name, t(`manage.broadcasts.sample.${name}`)])),
        event_name: eventName,
        ...(site ? {event_url: `${site.origin}/`, user_email: `participant@${site.hostname}`} : {}),
    };
}

export type BroadcastDraft = {
    email: boolean; inApp: boolean;
    Subject: string; Preheader: string; Body: EmailBodyBlock[]; Styling: Record<string, unknown>;
    InAppTitle: string; InAppBody: string; InAppLink: string;
    Audience: BroadcastAudience;
};

// The message of a broadcast without its audience: what a saved broadcast template holds.
export type BroadcastMessage = Omit<BroadcastDraft, "Audience">;

export function emptyMessage(): BroadcastMessage {
    return {email: true, inApp: false, Subject: "", Preheader: "", Body: [defaultBlockForType("rich_text")], Styling: {}, InAppTitle: "", InAppBody: "", InAppLink: ""};
}

export function emptyDraft(): BroadcastDraft {
    return {...emptyMessage(), Audience: {Kind: "all_participants", Roles: [], UserIDs: [], TeamIDs: []}};
}

// A saved template as composer fields: exactly its channels and texts.
export function templateMessage(record: BroadcastTemplateRecord): BroadcastMessage {
    const email = record.Channels.includes("email");
    const body = Array.isArray(record.EmailBody) && record.EmailBody.length > 0 ? record.EmailBody as EmailBodyBlock[] : [defaultBlockForType("rich_text")];
    const styling = record.EmailStyling && typeof record.EmailStyling === "object" && !Array.isArray(record.EmailStyling) ? record.EmailStyling as Record<string, unknown> : {};
    return {
        email, inApp: record.Channels.includes("in_app"),
        Subject: record.Subject, Preheader: record.Preheader, Body: email ? body : [defaultBlockForType("rich_text")], Styling: email ? styling : {},
        InAppTitle: record.InAppTitle, InAppBody: record.InAppBody, InAppLink: record.InAppLink,
    };
}

// The fields saved with a template: only the parts of the chosen channels.
export function templateInput(name: string, message: BroadcastMessage): BroadcastTemplateInput {
    const payload = broadcastPayload({...message, Audience: {Kind: "", Roles: [], UserIDs: [], TeamIDs: []}});
    return {
        Name: name.trim(), Channels: payload.Channels, Subject: payload.Subject, Preheader: payload.Preheader, EmailBody: payload.EmailBody, EmailStyling: payload.EmailStyling,
        InAppTitle: payload.InAppTitle, InAppBody: payload.InAppBody, InAppLink: payload.InAppLink,
    };
}

export function templateNameError(name: string): string {
    if (!name.trim()) return t("manage.customTemplates.validation.name");
    if ([...name.trim()].length > 200) return t("manage.customTemplates.validation.nameLength", {max: 200});
    return "";
}

export const audienceKindOptions: EventAudienceKind[] = ["all_participants", "approved", "pending", "captains", "teams", "participants", "staff"];

export function audienceReady(audience: BroadcastAudience): boolean {
    if (audience.Kind === "teams") return audience.TeamIDs.length > 0;
    if (audience.Kind === "participants") return audience.UserIDs.length > 0;
    return true;
}

// Only the ids the kind uses are sent.
export function normalizedAudience(audience: BroadcastAudience): BroadcastAudience {
    return {Kind: audience.Kind, Roles: [], UserIDs: audience.Kind === "participants" ? audience.UserIDs : [], TeamIDs: audience.Kind === "teams" ? audience.TeamIDs : []};
}

export function emailBodyFilled(body: EmailBodyBlock[]): boolean {
    return body.some(block => (block.type === "rich_text" && emailRichText(block as never).trim() !== "") || block.type === "button" || block.type === "preset");
}

export function emailValidation(draft: BroadcastMessage): string {
    if (!draft.Subject.trim()) return t("manage.broadcasts.validation.subject");
    if (!emailBodyFilled(draft.Body)) return t("manage.broadcasts.validation.body");
    if (draft.Body.some(block => block.type === "button" && (!String(block.label ?? "").trim() || !String(block.url ?? "").trim()))) return t("manage.broadcasts.validation.buttons");
    return "";
}

export function inAppValidationText(draft: BroadcastMessage): string {
    return draft.InAppTitle.trim() ? "" : t("manage.broadcasts.validation.inAppTitle");
}

// The first reason the message itself is incomplete; empty when it is ready.
export function messageValidation(draft: BroadcastMessage): string {
    if (!draft.email && !draft.inApp) return t("manage.broadcasts.validation.channels");
    if (draft.email) {const reason = emailValidation(draft); if (reason) return reason;}
    if (draft.inApp) {const reason = inAppValidationText(draft); if (reason) return reason;}
    return "";
}

// The first reason the message cannot be sent; empty when it can.
export function composeValidation(draft: BroadcastDraft): string {
    const reason = messageValidation(draft);
    if (reason) return reason;
    if (!audienceReady(draft.Audience)) return t(draft.Audience.Kind === "teams" ? "manage.broadcasts.validation.teams" : "manage.broadcasts.validation.participants");
    return "";
}

export function channelsOf(draft: Pick<BroadcastDraft, "email" | "inApp">): BroadcastChannel[] {
    return [...(draft.email ? ["email" as const] : []), ...(draft.inApp ? ["in_app" as const] : [])];
}

export function broadcastPayload(draft: BroadcastDraft): BroadcastInput {
    return {
        Channels: channelsOf(draft),
        Subject: draft.email ? draft.Subject : "", Preheader: draft.email ? draft.Preheader : "",
        EmailBody: draft.email ? draft.Body : [], EmailStyling: draft.email ? draft.Styling : {},
        InAppTitle: draft.inApp ? draft.InAppTitle : "", InAppBody: draft.inApp ? draft.InAppBody : "", InAppLink: draft.inApp ? draft.InAppLink : "",
        Audience: normalizedAudience(draft.Audience),
    };
}

export function emailPreviewInput(draft: BroadcastMessage): ManageEmailTemplateInput {
    return {NotificationType: "broadcast", Subject: draft.Subject, Preheader: draft.Preheader, Body: draft.Body, Styling: draft.Styling};
}

export function inAppPreviewInput(draft: Pick<BroadcastDraft, "InAppTitle" | "InAppBody" | "InAppLink">): ManageInAppTemplateInput {
    return {NotificationType: "broadcast", Title: draft.InAppTitle, Body: draft.InAppBody, Link: draft.InAppLink, Icon: "bell", Tone: "neutral", AccentColor: "", Surface: "", AutoDismissMs: null, Actions: [], Dismissible: true};
}

export function channelLabel(channel: string): string {
    return channel === "email" ? t("manage.broadcasts.channel.email") : channel === "in_app" ? t("manage.broadcasts.channel.inApp") : channel;
}

export function channelsLabel(channels: string[]): string {
    return channels.map(channelLabel).join(", ");
}

// The audience of a sent broadcast as text: the kind, and how many teams or people were picked.
export function audienceLabel(audience: Broadcast["Audience"]): string {
    const kind = t(`manage.broadcasts.audience.${audience.Kind}`);
    if (audience.Kind === "teams") return `${kind}: ${audience.TeamIDs.length}`;
    if (audience.Kind === "participants") return `${kind}: ${audience.UserIDs.length}`;
    return kind;
}

// The heading of a broadcast in lists: the email subject, else the in-app title.
export function broadcastTitle(broadcast: Pick<Broadcast, "Subject" | "InAppTitle">): string {
    return broadcast.Subject.trim() || broadcast.InAppTitle.trim() || "—";
}
