// Test helper: a stateful fake of the event manage API for the notification pages.
import {vi} from "vitest";

export const FINISHED = "participant.event.finished";
export const REMINDER = "participant.event.start_reminder";
export const EVENT_ID = "01a0d498-32b3-7a38-8355-30cc209f56ab";
export const uuid = (n: number) => `0190c6a4-0000-7000-8000-${String(n).padStart(12, "0")}`;
export type Call = {method: string; path: string; body: Record<string, unknown>};
const text = {detail: 0, format: 0, mode: "normal", style: "", text: "Привіт", type: "text", version: 1};
const paragraph = {children: [text], direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1, textFormat: 0, textStyle: ""};
const body = [{type: "rich_text", content: {root: {children: [paragraph], direction: "ltr", format: "", indent: 0, type: "root", version: 1}}}];

export function emailTemplate(n: number, type: string, patch: Record<string, unknown> = {}) {
    return {ID: uuid(n), ScopeEventID: null, NotificationType: type, Status: "published", Subject: "Тема листа", Preheader: "", Body: body, Styling: {}, PublishedAt: "2026-09-01T00:00:00Z", UpdatedByUserID: null, CreatedAt: "2026-09-01T00:00:00Z", UpdatedAt: "2026-09-01T00:00:00Z", Source: "platform", ...patch};
}

export function inAppTemplate(n: number, patch: Record<string, unknown> = {}) {
    return {ID: uuid(n), ScopeEventID: null, NotificationType: FINISHED, Status: "published", Title: "Захід {{.event_name}} завершено", Body: "Дякуємо, <strong>{{.event_name}}</strong>", Link: "", Icon: "trophy", Tone: "success", AccentColor: "", Surface: "inbox", AutoDismissMs: null, Actions: [], Dismissible: true, PublishedAt: "2026-09-01T00:00:00Z", UpdatedByUserID: null, CreatedAt: "2026-09-01T00:00:00Z", UpdatedAt: "2026-09-01T00:00:00Z", Source: "platform", ...patch};
}

export function subscription(type: string, channel: "email" | "in_app", patch: Record<string, unknown> = {}) {
    return {SignalType: type, Channel: channel, Enabled: true, Audience: {kind: "all_participants"}, Source: "platform", Required: false, Config: {}, ...patch};
}

export function fakeServer(channel: "email" | "in_app", subscriptions: unknown[], templates: Array<Record<string, unknown>>) {
    const calls: Call[] = [];
    let list = templates;
    const kind = channel === "email" ? "email" : "in-app";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        const path = url.pathname.replace(/^.*\/manage\//, "");
        const payload = (init?.body ? JSON.parse(String(init.body)) : {}) as Record<string, unknown> & {SignalType: string; Channel: "email" | "in_app"};
        calls.push({method, path, body: payload});
        let data: unknown = {};
        if (path === "notification-subscriptions" && method === "GET") data = subscriptions;
        else if (path === "notification-subscriptions") data = {...subscription(payload.SignalType, payload.Channel), ...payload, Source: "event"};
        else if (path === "notification-types") data = [{Type: REMINDER, Channels: ["email"], Variables: [{Name: "event_name", Description: "Назва заходу", Default: "Приклад"}]}, {Type: FINISHED, Channels: ["email", "in_app"], Variables: [{Name: "event_name", Description: "Назва заходу", Default: "Приклад"}]}];
        else if (path === `notification-templates/${kind}` && method === "GET") data = list;
        else if (path.endsWith("/preview")) data = {Subject: "Тема з прикладу", Preheader: "Вступ", HTML: "<p>Привіт, учаснику</p>"};
        else if (path.endsWith("/customize")) {
            const source = list.find(item => path.includes(String(item.ID)))!;
            const copy = {...source, ID: uuid(900), Source: "event", Status: "draft", ScopeEventID: EVENT_ID};
            list = [copy, ...list];
            data = copy;
        } else if (path.includes(`notification-templates/${kind}/type/`)) {
            list = list.filter(item => item.Source !== "event");
        } else if (path.endsWith("/rollback")) {
            const source = list.find(item => path.includes(String(item.ID)))!;
            const copy = {...source, ID: uuid(901), Status: "draft"};
            list = [copy, ...list];
            data = copy;
        }
        return new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
    }) as typeof fetch;
    return calls;
}
