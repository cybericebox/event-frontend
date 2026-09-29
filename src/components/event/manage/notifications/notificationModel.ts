import type {ManageNotificationType} from "@/api/manageNotifications";

type Versioned = {NotificationType: string; Status: "draft" | "published" | "unpublished"; UpdatedAt: string};
type Owned = {Source: "platform" | "event"; Status: Versioned["Status"]};

// How the right side of a signal page shows its template:
// none      - the signal has no template at all;
// platform  - the platform template, not copied for the event yet (read-only);
// edit      - the event draft, open in the editor;
// view      - the event's published version (read-only, editable via a draft copy);
// previous  - an older event version (read-only, can be restored as a draft).
export type TemplateMode = "none" | "platform" | "edit" | "view" | "previous";

export function templateMode(template: Owned | undefined): TemplateMode {
    if (!template) return "none";
    if (template.Source === "platform") return "platform";
    return template.Status === "draft" ? "edit" : template.Status === "published" ? "view" : "previous";
}

// A draft first, then the published version, then older ones; newest first within a status.
export function orderedVersions<T extends Versioned & Partial<Owned>>(items: T[], signal: string): T[] {
    const rank = (item: T) => item.Status === "draft" ? 0 : item.Status === "published" ? 1 : 2;
    const ofSignal = items.filter(item => item.NotificationType === signal);
    // Once the event has its own copy, the platform template is not offered any more.
    const own = ofSignal.filter(item => item.Source !== "platform");
    return (own.length ? own : ofSignal).sort((a, b) => rank(a) - rank(b) || b.UpdatedAt.localeCompare(a.UpdatedAt));
}

// Sample value of every template variable of a signal: the catalog default,
// with the event's own name for event_name.
export function sampleValues(type: ManageNotificationType | undefined, eventName: string): Record<string, string> {
    const values = Object.fromEntries((type?.Variables ?? []).map(variable => [variable.Name, variable.Default]));
    return {...values, event_name: eventName};
}

const escapes: Record<string, string> = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};

// Fills {{.name}} / {{name}} with the sample values; a variable without a
// value expands to nothing. `html` escapes the values for an HTML body.
export function fillSamples(text: string, values: Record<string, string>, html = false): string {
    return text.replace(/\{\{\s*\.?(\w+)\s*\}\}/g, (_, name: string) => {
        const value = values[name] ?? "";
        return html ? value.replace(/[&<>"']/g, char => escapes[char]) : value;
    });
}

// Inserts text at the caret of a field and returns the new value and caret.
export function insertAtCaret(value: string, text: string, start: number | null, end: number | null): {value: string; caret: number} {
    const from = Math.min(start ?? value.length, value.length);
    const to = Math.min(Math.max(end ?? from, from), value.length);
    return {value: value.slice(0, from) + text + value.slice(to), caret: from + text.length};
}

export function variableToken(name: string): string {
    return `{{.${name}}}`;
}

export type ListStatus = "published" | "draft" | "unpublished" | "platform";

// What the list shows for a signal: the event's own effective version
// (published, else draft, else older) or the untouched platform template.
export function listStatus(versions: Array<Owned>): {status: ListStatus; draftPending: boolean} {
    const own = versions.filter(item => item.Source === "event");
    const has = (status: Versioned["Status"]) => own.some(item => item.Status === status);
    const status: ListStatus = has("published") ? "published" : has("draft") ? "draft" : has("unpublished") ? "unpublished" : "platform";
    return {status, draftPending: has("published") && has("draft")};
}
