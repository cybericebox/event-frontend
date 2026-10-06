// @vitest-environment jsdom
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const EVENT_ID = "01a0d498-32b3-7a38-8355-30cc209f56ab";
const manager = vi.hoisted(() => ({canManage: true}));
vi.mock("../ManagerShell", () => ({useManager: () => ({event: {EventID: EVENT_ID, Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: manager.canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {BannersManager} from "./BannersManager";
import {bannerValidation, emptyBannerForm} from "./bannerModel";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

const uuid = (n: number) => `0190c6a4-0000-7000-8000-${String(n).padStart(12, "0")}`;
const banner = (n: number, patch: Record<string, unknown> = {}) => ({
    ID: uuid(n), ScopeEventID: EVENT_ID, Text: `Банер ${n}`, LinkURL: "", LinkLabel: "", Level: "info", ActiveFrom: null, ActiveTo: null, Dismissible: true,
    Audience: "everyone", IsActive: true, CreatedAt: "2026-09-29T07:30:00Z", UpdatedAt: "2026-09-29T07:30:00Z", ...patch,
});

type Call = {method: string; path: string; body: unknown};
function mockServer(list: unknown[] | Response) {
    const calls: Call[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({method, path: new URL(String(input)).pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined});
        if (method === "GET" && list instanceof Response) return list;
        if (method === "DELETE") return new Response(JSON.stringify({Status: {Code: 0}, Data: null}), {status: 200});
        return new Response(JSON.stringify({Status: {Code: 0}, Data: method === "GET" ? list : banner(9)}), {status: 200});
    }) as typeof fetch;
    return calls;
}
const wrap = () => render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><BannersManager /></QueryClientProvider>);

beforeEach(() => {manager.canManage = true;});
afterEach(() => {cleanup(); vi.restoreAllMocks();});

describe("Банери заходу", () => {
    it("lists the banners drawn by the shared banner component with their state", async () => {
        mockServer([banner(1), banner(2, {Level: "critical", IsActive: false, Audience: "participants", ActiveFrom: "2026-10-01T08:00:00Z"})]);
        const {container} = wrap();
        expect(await screen.findByText("Банер 1")).toBeTruthy();
        expect(container.querySelector(".ib-banner--danger")).not.toBeNull();
        expect(screen.getByText("Вимкнено")).toBeTruthy();
        expect(screen.getByText("Учасникам заходу")).toBeTruthy();
        expect(screen.getByText("Без обмеження за часом")).toBeTruthy();
    });

    it("shows the empty, loading and error states in the block", async () => {
        globalThis.fetch = vi.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;
        const loading = wrap();
        expect(screen.getByRole("status", {name: "Завантажуємо банери"})).toBeTruthy();
        loading.unmount();
        mockServer([]);
        const empty = wrap();
        expect(await screen.findByText("Банерів ще немає.")).toBeTruthy();
        empty.unmount();
        mockServer(new Response("{}", {status: 500}));
        wrap();
        expect(await screen.findByText("Не вдалося завантажити банери")).toBeTruthy();
    });

    it("creates a banner with a live preview and the API payload", async () => {
        const calls = mockServer([]);
        wrap();
        await screen.findByText("Банерів ще немає.");
        fireEvent.click(screen.getByRole("button", {name: /Створити банер/}));
        const dialog = screen.getByText("Новий банер", {selector: "h2"}).closest("dialog")!;
        const save = within(dialog).getByRole("button", {name: "Зберегти"}) as HTMLButtonElement;
        expect(save.disabled).toBe(true);
        fireEvent.change(within(dialog).getByRole("textbox", {name: /Текст/}), {target: {value: "Технічні роботи"}});
        expect(dialog.querySelector(".event-banner-preview .ib-banner")?.textContent).toContain("Технічні роботи");
        fireEvent.change(within(dialog).getByRole("textbox", {name: /^Посилання/}), {target: {value: "/faq"}});
        expect(dialog.querySelector(".event-banner-preview a")?.getAttribute("href")).toBe("/faq");
        expect(save.disabled).toBe(false);
        fireEvent.click(save);
        await waitFor(() => expect(calls.some(call => call.method === "POST")).toBe(true));
        expect(calls.find(call => call.method === "POST")!.body).toEqual({
            Text: "Технічні роботи", LinkURL: "/faq", LinkLabel: "", Level: "info", ActiveFrom: null, ActiveTo: null, Dismissible: true, Audience: "everyone", IsActive: true,
        });
    });

    it("turns a banner off by sending it back with IsActive false", async () => {
        const calls = mockServer([banner(1)]);
        wrap();
        await screen.findByText("Банер 1");
        fireEvent.click(screen.getByRole("button", {name: "Вимкнути"}));
        await waitFor(() => expect(calls.some(call => call.method === "PUT")).toBe(true));
        const put = calls.find(call => call.method === "PUT")!;
        expect(put.path.endsWith(`/manage/banners/${uuid(1)}`)).toBe(true);
        expect(put.body).toMatchObject({Text: "Банер 1", IsActive: false});
    });

    it("flips the banner state before the server answers and keeps every other button enabled", async () => {
        let release: (response: Response) => void = () => undefined;
        const calls: Call[] = [];
        globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const method = init?.method ?? "GET";
            calls.push({method, path: new URL(String(input)).pathname, body: undefined});
            if (method === "PUT") return new Promise<Response>(resolve => {release = resolve;});
            return Promise.resolve(new Response(JSON.stringify({Status: {Code: 0}, Data: [banner(1), banner(2)]}), {status: 200}));
        }) as typeof fetch;
        wrap();
        await screen.findByText("Банер 1");
        fireEvent.click(screen.getAllByRole("button", {name: "Вимкнути"})[0]);
        // Optimistic: the label is already «Увімкнути»; the save is still in flight.
        await waitFor(() => expect(screen.getAllByRole("button", {name: "Увімкнути"})).toHaveLength(1));
        expect(calls.filter(call => call.method === "PUT")).toHaveLength(1);
        for (const button of screen.getAllByRole("button", {name: /Вимкнути|Увімкнути|Видалити|Редагувати/})) expect((button as HTMLButtonElement).disabled).toBe(false);
        release(new Response(JSON.stringify({Status: {Code: 0}, Data: banner(1, {IsActive: false})}), {status: 200}));
        await waitFor(() => expect(screen.getAllByRole("button", {name: "Увімкнути"})).toHaveLength(1));
    });

    it("rolls the banner state back and refetches when the save fails", async () => {
        let gets = 0;
        globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            const method = init?.method ?? "GET";
            if (method === "PUT") return new Response("{}", {status: 500});
            gets += 1;
            return new Response(JSON.stringify({Status: {Code: 0}, Data: [banner(1)]}), {status: 200});
        }) as typeof fetch;
        wrap();
        await screen.findByText("Банер 1");
        fireEvent.click(screen.getByRole("button", {name: "Вимкнути"}));
        await waitFor(() => expect(gets).toBe(2));
        await waitFor(() => expect(screen.getByRole("button", {name: "Вимкнути"})).toBeTruthy());
    });

    it("deletes through the danger confirmation", async () => {
        const calls = mockServer([banner(1)]);
        wrap();
        await screen.findByText("Банер 1");
        fireEvent.click(screen.getByRole("button", {name: "Видалити"}));
        const dialog = screen.getByText("Видалити банер?").closest("dialog")!;
        const confirm = within(dialog).getByRole("button", {name: "Видалити"});
        expect(confirm.className).toContain("ib-btn--danger-solid");
        fireEvent.click(confirm);
        await waitFor(() => expect(calls.some(call => call.method === "DELETE" && call.path.endsWith(`/manage/banners/${uuid(1)}`))).toBe(true));
    });

    it("gives a viewer no actions and explains why", async () => {
        manager.canManage = false;
        mockServer([banner(1)]);
        wrap();
        await screen.findByText("Банер 1");
        expect((screen.getByRole("button", {name: /Створити банер/}) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.queryByRole("button", {name: "Редагувати"})).toBeNull();
        expect(screen.getByRole("button", {name: "Чому не можна створити банер"})).toBeTruthy();
    });

    it("validates the text, the link and the window", () => {
        const form = emptyBannerForm();
        expect(bannerValidation(form)).toBe("Вкажіть текст банера.");
        expect(bannerValidation({...form, Text: "x".repeat(281)})).toContain("280");
        expect(bannerValidation({...form, Text: "ok", LinkURL: "javascript:1"})).toContain("http(s)");
        expect(bannerValidation({...form, Text: "ok", ActiveFrom: "2026-10-02T10:00", ActiveTo: "2026-10-01T10:00"})).toContain("пізніше");
        expect(bannerValidation({...form, Text: "ok", LinkURL: "https://a.b"})).toBe("");
    });
});
