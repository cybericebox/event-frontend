import type {ManageEmailTemplate} from "@/api/manageEmailTemplates";
import type {ManageInAppTemplate} from "@/api/manageNotifications";
import {signalLabel} from "@/api/manageNotifications";
import {orderedVersions} from "../notifications/notificationModel";
import type {EmailBodyBlock} from "../notifications/editor/emailBlocks";
import type {BroadcastTemplateRecord} from "@/api/manageBroadcastTemplates";
import {broadcastVariableNames, templateMessage, type BroadcastDraft, type BroadcastMessage} from "./broadcastModel";

// What a broadcast can start from: a saved broadcast template («saved», exactly its channels) or the published
// template of one signal, per channel («signal», only turns its channels on).
export type BroadcastTemplate = {
    type: string;
    label: string;
    kind?: "saved" | "signal";
    email?: Pick<BroadcastDraft, "Subject" | "Preheader" | "Body" | "Styling">;
    inApp?: Pick<BroadcastDraft, "InAppTitle" | "InAppBody" | "InAppLink">;
};

// The saved broadcast templates of the event, by name.
export function savedBroadcastTemplates(records: BroadcastTemplateRecord[]): BroadcastTemplate[] {
    return records.map(record => {
        const message = templateMessage(record);
        return {
            type: `saved:${record.ID}`, label: record.Name, kind: "saved" as const,
            ...(message.email ? {email: {Subject: message.Subject, Preheader: message.Preheader, Body: message.Body, Styling: message.Styling}} : {}),
            ...(message.inApp ? {inApp: {InAppTitle: message.InAppTitle, InAppBody: message.InAppBody, InAppLink: message.InAppLink}} : {}),
        };
    }).sort((a, b) => a.label.localeCompare(b.label, "uk"));
}

// The message with the template applied: a saved template sets exactly its channels, a signal template turns on its own.
export function withTemplate<T extends BroadcastMessage>(current: T, template: BroadcastTemplate): T {
    return {
        ...current,
        ...(template.kind === "saved" ? {email: !!template.email, inApp: !!template.inApp} : {}),
        ...(template.email ? {email: true, ...template.email} : {}),
        ...(template.inApp ? {inApp: true, ...template.inApp} : {}),
    };
}

// The published templates the template pages list: the event's own copy when it has one, else the inherited platform one.
export function broadcastTemplates(emails: ManageEmailTemplate[], inApps: ManageInAppTemplate[]): BroadcastTemplate[] {
    const byType = new Map<string, BroadcastTemplate>();
    const entry = (type: string) => {
        let found = byType.get(type);
        if (!found) {found = {type, label: signalLabel(type).title}; byType.set(type, found);}
        return found;
    };
    for (const type of new Set(emails.map(item => item.NotificationType))) {
        const published = orderedVersions(emails, type).find(item => item.Status === "published");
        if (published) entry(type).email = {Subject: published.Subject, Preheader: published.Preheader, Body: published.Body as EmailBodyBlock[], Styling: published.Styling};
    }
    for (const type of new Set(inApps.map(item => item.NotificationType))) {
        const published = orderedVersions(inApps, type).find(item => item.Status === "published");
        if (published) entry(type).inApp = {InAppTitle: published.Title, InAppBody: published.Body, InAppLink: published.Link};
    }
    return [...byType.values()].sort((a, b) => a.label.localeCompare(b.label, "uk"));
}

const token = /\{\{\s*\.?\s*([A-Za-z_]\w*)\s*\}\}/g;
const supported: readonly string[] = broadcastVariableNames;

// Variable names used in the texts that a broadcast cannot fill, in order of first use.
export function unsupportedVariables(texts: string[]): string[] {
    const found = new Set<string>();
    for (const text of texts) for (const match of text.matchAll(token)) if (!supported.includes(match[1])) found.add(match[1]);
    return [...found];
}

// The text as a recipient would get it: variables the broadcast cannot fill come out empty.
export function withoutUnsupported(text: string): string {
    return text.replace(token, (whole, name: string) => supported.includes(name) ? whole : "");
}

// The draft as it is previewed: unsupported variables are empty.
export function previewDraft<T extends BroadcastMessage>(draft: T): T {
    return {
        ...draft,
        Subject: withoutUnsupported(draft.Subject), Preheader: withoutUnsupported(draft.Preheader),
        Body: JSON.parse(withoutUnsupported(JSON.stringify(draft.Body))) as EmailBodyBlock[],
        InAppTitle: withoutUnsupported(draft.InAppTitle), InAppBody: withoutUnsupported(draft.InAppBody), InAppLink: withoutUnsupported(draft.InAppLink),
    };
}

// The variables of the channels being composed that the broadcast cannot fill.
export function draftUnsupported(draft: BroadcastMessage): string[] {
    return unsupportedVariables([
        ...(draft.email ? [draft.Subject, draft.Preheader, JSON.stringify(draft.Body)] : []),
        ...(draft.inApp ? [draft.InAppTitle, draft.InAppBody, draft.InAppLink] : []),
    ]);
}
