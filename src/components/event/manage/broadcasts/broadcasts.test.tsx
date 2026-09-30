// @vitest-environment jsdom
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const EVENT_ID = "01a0d498-32b3-7a38-8355-30cc209f56ab";
const manager = vi.hoisted(() => ({canManage: true}));
const router = vi.hoisted(() => ({push: vi.fn(), replace: vi.fn()}));
vi.mock("next/navigation", () => ({useRouter: () => router}));
vi.mock("../ManagerShell", () => ({useManager: () => ({event: {EventID: EVENT_ID, Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: manager.canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {BroadcastCompose} from "./BroadcastCompose";
import {BroadcastDetails} from "./BroadcastDetails";
import {BroadcastHistory} from "./BroadcastHistory";
import {composeValidation, emptyDraft} from "./broadcastModel";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

const uuid = (n: number) => `0190c6a4-0000-7000-8000-${String(n).padStart(12, "0")}`;
function broadcast(n: number, patch: Record<string, unknown> = {}) {
    return {
        ID: uuid(n), ScopeEventID: EVENT_ID, EventName: "CTF 2027", CreatedBy: uuid(500), CreatedByName: "Олена Коваленко", Channels: ["email", "in_app"],
        Subject: `Тема ${n}`, Preheader: "", EmailBody: [{type: "divider"}], EmailStyling: {}, InAppTitle: `Заголовок ${n}`, InAppBody: "", InAppLink: "",
        Audience: {Kind: "approved", Roles: [], UserIDs: [], TeamIDs: []}, RecipientCount: 40, SentCount: 38, FailedCount: 2, Status: "done",
        CreatedAt: "2026-09-29T07:30:00Z", FinishedAt: "2026-09-29T07:31:00Z", ...patch,
    };
}

type Call = {method: string; path: string; body: unknown};
function mockServer(routes: (call: Call) => unknown | Response) {
    const calls: Call[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const call: Call = {method: init?.method ?? "GET", path: url.pathname + url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined};
        calls.push(call);
        const result = routes(call);
        if (result instanceof Response) return result;
        return new Response(JSON.stringify({Status: {Code: 0}, Data: result}), {status: 200});
    }) as typeof fetch;
    return calls;
}

function wrap(node: React.ReactNode) {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{node}</QueryClientProvider>);
}

beforeEach(() => {manager.canManage = true;});
afterEach(() => {cleanup(); router.push.mockClear(); vi.restoreAllMocks();});

describe("Історія розсилок", () => {
    it("lists the broadcasts with audience, counters, status and author", async () => {
        mockServer(() => ({Items: [broadcast(1), broadcast(2, {Channels: ["in_app"], Subject: "", Audience: {Kind: "teams", Roles: [], UserIDs: [], TeamIDs: [uuid(7), uuid(8)]}, Status: "sending"})], Total: 2}));
        wrap(<BroadcastHistory />);
        const table = screen.getByRole("table");
        await waitFor(() => expect(within(table).getByText("Тема 1")).toBeTruthy());
        expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Повідомлення", "Канали", "Аудиторія", "Отримувачі", "Надіслано", "Помилки", "Статус", "Автор", "Дата"]);
        expect(within(table).getByText("Електронна пошта, У застосунку")).toBeTruthy();
        expect(within(table).getByText("Лише схвалені учасники")).toBeTruthy();
        expect(within(table).getByText("Заголовок 2")).toBeTruthy();
        expect(within(table).getByText("Обрані команди: 2")).toBeTruthy();
        expect(within(table).getByText("Надсилається")).toBeTruthy();
        expect(within(table).getAllByText("Олена Коваленко")).toHaveLength(2);
        expect(within(table).getByRole("link", {name: "Тема 1"}).getAttribute("href")).toBe(`/manage/broadcasts/${uuid(1)}`);
        expect(screen.getByRole("link", {name: /Надіслати повідомлення/}).getAttribute("href")).toBe("/manage/broadcasts/new");
    });

    it("walks the pages by cursor", async () => {
        const calls = mockServer(call => call.path.includes("cursor=") ? {Items: [broadcast(3)], Total: 1} : {Items: [broadcast(1)], Total: 1, NextCursor: uuid(1)});
        wrap(<BroadcastHistory />);
        await screen.findByText("Тема 1");
        fireEvent.click(screen.getByRole("button", {name: "Далі"}));
        await screen.findByText("Тема 3");
        expect(calls.some(call => call.path.includes(`cursor=${uuid(1)}`))).toBe(true);
    });

    it("shows the loading, empty and error states inside the block", async () => {
        globalThis.fetch = vi.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;
        const loading = wrap(<BroadcastHistory />);
        expect(screen.getByRole("status", {name: "Завантажуємо розсилки"})).toBeTruthy();
        loading.unmount();
        mockServer(() => ({Items: [], Total: 0}));
        const empty = wrap(<BroadcastHistory />);
        await screen.findByText("Розсилок ще не було.");
        expect(screen.getByRole("table").querySelector("[data-empty-state]")).not.toBeNull();
        empty.unmount();
        mockServer(() => new Response("{}", {status: 500}));
        wrap(<BroadcastHistory />);
        expect(await screen.findByText("Не вдалося завантажити розсилки")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
    });

    it("disables «Надіслати повідомлення» for a viewer and explains why", async () => {
        manager.canManage = false;
        mockServer(() => ({Items: [], Total: 0}));
        wrap(<BroadcastHistory />);
        const button = screen.getByRole("button", {name: /Надіслати повідомлення/}) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        expect(screen.queryByRole("link", {name: /Надіслати повідомлення/})).toBeNull();
        const help = screen.getByRole("button", {name: "Чому не можна надіслати повідомлення"});
        expect(document.getElementById(help.getAttribute("aria-describedby")!)?.textContent).toContain("лише для перегляду");
    });
});

describe("Розсилка: деталі", () => {
    it("shows the facts and the recipients with the failures", async () => {
        mockServer(call => call.path.includes("/deliveries") ? [
            {DispatchID: uuid(20), RecipientUserID: uuid(30), RecipientEmail: "bad@example.com", DispatchStatus: "error", Channel: "email", TargetStatus: "error", Error: "550 rejected"},
            {DispatchID: uuid(21), RecipientUserID: uuid(31), RecipientEmail: "ok@example.com", DispatchStatus: "done", Channel: "in_app", TargetStatus: "done", Error: ""},
        ] : call.path.includes("/preview") ? {Subject: "s", Preheader: "", HTML: "<p>x</p>"} : broadcast(1));
        wrap(<BroadcastDetails broadcastID={uuid(1)} />);
        expect(await screen.findByRole("heading", {name: "Тема 1"})).toBeTruthy();
        const table = await screen.findByRole("table");
        await waitFor(() => expect(within(table).getByText("550 rejected")).toBeTruthy());
        const rows = within(table).getAllByRole("row").slice(1);
        expect(rows[0].textContent).toContain("bad@example.com");
        expect(rows[1].textContent).toContain("ok@example.com");
    });

    it("shows a load error with a retry", async () => {
        mockServer(() => new Response("{}", {status: 404}));
        wrap(<BroadcastDetails broadcastID={uuid(1)} />);
        expect(await screen.findByText("Не вдалося завантажити розсилку")).toBeTruthy();
    });
});

const emailTemplates: unknown[] = [];
const inAppTemplates: unknown[] = [];
const templateBase = {ScopeEventID: null, NotificationType: "participant.event.finished", Status: "published", PublishedAt: "2026-09-01T00:00:00Z", UpdatedByUserID: null, CreatedAt: "2026-09-01T00:00:00Z", UpdatedAt: "2026-09-01T00:00:00Z", Source: "platform"};

describe("Нова розсилка", () => {
    beforeEach(() => {
        emailTemplates.splice(0, emailTemplates.length, {...templateBase, ID: uuid(61), Subject: "Привіт, {{.user_name}} {{.team_name}}", Preheader: "", Body: [{type: "button", label: "Відкрити {{.team_name}}", url: "https://x.test"}], Styling: {}});
        inAppTemplates.splice(0, inAppTemplates.length, {...templateBase, ID: uuid(62), Title: "Дякуємо, {{.user_name}}", Body: "", Link: "", Icon: "bell", Tone: "neutral", AccentColor: "", Surface: "", AutoDismissMs: null, Actions: [], Dismissible: true});
    });
    async function pickTemplate() {
        fireEvent.pointerDown(await screen.findByRole("button", {name: "Почати з шаблону"}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "Захід завершено"}));
    }

    function server(extra?: (call: Call) => unknown | undefined) {
        return mockServer(call => {
            const own = extra?.(call);
            if (own !== undefined) return own;
            if (call.path.endsWith("/audience-count")) return {Count: 12};
            if (call.method === "POST" && call.path.endsWith("/manage/broadcasts")) return broadcast(9);
            if (call.path.endsWith("/presets")) return [];
            if (call.path.endsWith("/notification-templates/email")) return emailTemplates;
            if (call.path.endsWith("/notification-templates/in-app")) return inAppTemplates;
            if (call.path.includes("/preview")) return {Subject: "s", Preheader: "", HTML: "<p>x</p>"};
            return {};
        });
    }
    async function fillInApp() {
        fireEvent.click(screen.getByRole("checkbox", {name: "Електронна пошта"}));
        fireEvent.click(screen.getByRole("checkbox", {name: "У застосунку"}));
        const title = await screen.findByRole("textbox", {name: "Заголовок"});
        title.textContent = "Старт о 10:00";
        fireEvent.input(title);
    }

    it("counts the audience live, confirms with the count and sends the payload", async () => {
        const calls = server();
        wrap(<BroadcastCompose />);
        await fillInApp();
        expect(await screen.findByText("Отримувачів: 12", {}, {timeout: 3000})).toBeTruthy();
        expect(calls.find(call => call.path.endsWith("/audience-count"))?.body).toEqual({Audience: {Kind: "all_participants", Roles: [], UserIDs: [], TeamIDs: []}});
        const send = screen.getByRole("button", {name: /Надіслати повідомлення/}) as HTMLButtonElement;
        await waitFor(() => expect(send.disabled).toBe(false));
        fireEvent.click(send);
        const dialog = screen.getByText("Надіслати 12 отримувачам?").closest("dialog")!;
        fireEvent.click(within(dialog).getByRole("button", {name: "Надіслати"}));
        await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/manage/broadcasts/${uuid(9)}`));
        const posted = calls.find(call => call.method === "POST" && call.path.endsWith("/manage/broadcasts"))!.body as Record<string, unknown>;
        expect(posted).toMatchObject({Channels: ["in_app"], Subject: "", InAppTitle: "Старт о 10:00", Audience: {Kind: "all_participants"}});
    });

    it("keeps the confirm dialog open and shows the server error inline", async () => {
        server(call => call.method === "POST" && call.path.endsWith("/manage/broadcasts") ? new Response(JSON.stringify({Status: {Code: 20222, Message: "empty"}}), {status: 400}) : undefined);
        wrap(<BroadcastCompose />);
        await fillInApp();
        await screen.findByText("Отримувачів: 12", {}, {timeout: 3000});
        const send = screen.getByRole("button", {name: /Надіслати повідомлення/}) as HTMLButtonElement;
        await waitFor(() => expect(send.disabled).toBe(false));
        fireEvent.click(send);
        const dialog = screen.getByText("Надіслати 12 отримувачам?").closest("dialog")!;
        fireEvent.click(within(dialog).getByRole("button", {name: "Надіслати"}));
        expect((await within(dialog).findByRole("alert")).textContent).toBe("У цій аудиторії немає отримувачів.");
        expect(router.push).not.toHaveBeenCalled();
    });

    it("offers no image block in the email editor", async () => {
        server();
        wrap(<BroadcastCompose />);
        await screen.findByRole("textbox", {name: "Тема листа"});
        expect(screen.queryByRole("button", {name: "Додати блок зображення"})).toBeNull();
        expect(screen.getByRole("button", {name: "Додати блок тексту"})).toBeTruthy();
    });

    it("picks teams and counts exactly those", async () => {
        const calls = server(call => call.path.includes("/manage/teams") ? {Items: [{ID: uuid(41), Name: "Alpha", CaptainID: uuid(50), Hidden: false, MemberCount: 3, CreatedAt: "2026-09-01T00:00:00Z"}], Total: 1} : undefined);
        wrap(<BroadcastCompose />);
        await fillInApp();
        fireEvent.pointerDown(screen.getByRole("button", {name: "Кому надіслати"}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "Обрані команди"}));
        fireEvent.click(await screen.findByRole("checkbox", {name: /Alpha/}));
        await waitFor(() => expect(calls.some(call => call.path.endsWith("/audience-count") && JSON.stringify(call.body).includes(uuid(41)))).toBe(true), {timeout: 3000});
        const last = calls.filter(call => call.path.endsWith("/audience-count")).at(-1)!;
        expect(last.body).toEqual({Audience: {Kind: "teams", Roles: [], UserIDs: [], TeamIDs: [uuid(41)]}});
    });

    it("blocks sending without a subject or a body and asks for the picked teams", () => {
        const draft = emptyDraft();
        expect(composeValidation(draft)).toBe("Вкажіть тему листа.");
        expect(composeValidation({...draft, Subject: "Тема"})).toBe("Додайте до листа текст або кнопку.");
        expect(composeValidation({...draft, email: false, inApp: true, InAppTitle: "Так", Audience: {Kind: "teams", Roles: [], UserIDs: [], TeamIDs: []}})).toBe("Оберіть хоча б одну команду.");
        expect(composeValidation({...draft, email: false, inApp: true, InAppTitle: "Так"})).toBe("");
        expect(composeValidation({...draft, email: false})).toBe("Оберіть хоча б один канал.");
    });

    it("does not let a viewer compose", () => {
        manager.canManage = false;
        server();
        wrap(<BroadcastCompose />);
        expect(screen.getByText(/лише для перегляду/)).toBeTruthy();
        expect(screen.queryByRole("button", {name: /Надіслати повідомлення/})).toBeNull();
    });

    it("starts from a template: prefills the email and in-app fields and warns about an unsupported variable", async () => {
        const calls = server();
        wrap(<BroadcastCompose />);
        await pickTemplate();
        expect((await screen.findByRole("textbox", {name: "Тема листа"})).textContent).toContain("Привіт");
        expect((await screen.findByRole("textbox", {name: "Заголовок"})).textContent).toContain("Дякуємо");
        expect(screen.queryByText("Замінити вміст розсилки шаблоном?")).toBeNull();
        expect(await screen.findByText("Змінна team_name недоступна в розсилці — буде порожньою")).toBeTruthy();
        expect(screen.queryByText(/Змінна user_name недоступна/)).toBeNull();
        // The preview is asked for with the unsupported variable already empty.
        await waitFor(() => {
            const preview = calls.filter(call => call.path.includes("/preview")).at(-1)?.body as {Subject: string; Body: unknown[]} | undefined;
            expect(preview?.Subject).toBe("Привіт, {{.user_name}} ");
            expect(JSON.stringify(preview?.Body)).not.toContain("team_name");
        }, {timeout: 3000});
        // The template itself is never written.
        expect(calls.some(call => call.method !== "GET" && call.path.includes("notification-templates") && !call.path.endsWith("/preview"))).toBe(false);
    });

    it("asks before replacing content that is already there", async () => {
        server();
        wrap(<BroadcastCompose />);
        const subject = await screen.findByRole("textbox", {name: "Тема листа"});
        subject.textContent = "Моя тема";
        fireEvent.input(subject);
        await pickTemplate();
        const dialog = (await screen.findByText("Замінити вміст розсилки шаблоном?")).closest("dialog")!;
        fireEvent.click(within(dialog).getByRole("button", {name: "Скасувати"}));
        expect(screen.getByRole("textbox", {name: "Тема листа"}).textContent).toBe("Моя тема");
        await pickTemplate();
        fireEvent.click(within((await screen.findByText("Замінити вміст розсилки шаблоном?")).closest("dialog")!).getByRole("button", {name: "Замінити"}));
        await waitFor(() => expect(screen.getByRole("textbox", {name: "Тема листа"}).textContent).toContain("Привіт"));
    });
});
