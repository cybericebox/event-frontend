// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {EVENT_ID, FINISHED, REMINDER, customTemplate, emailTemplate, fakeServer, inAppTemplate, subscription, uuid, type Call} from "./fixtures/server";

const manager = vi.hoisted(() => ({canManage: true}));
const router = vi.hoisted(() => ({push: vi.fn(), replace: vi.fn()}));
vi.mock("next/navigation", () => ({useRouter: () => router, usePathname: () => "/manage/email"}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: EVENT_ID, Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: manager.canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import ManageEmailPage from "@/app/manage/email/page";
import ManageNotificationsPage from "@/app/manage/notifications/page";
import {CustomTemplateEditor} from "./CustomTemplateEditor";
import {templateInput, templateMessage} from "../broadcasts/broadcastModel";
import {zoneOffset} from "@/utils/dateTime";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

function wrap(node: React.ReactNode) {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{node}</QueryClientProvider>);
}

afterEach(() => {cleanup(); manager.canManage = true; router.push.mockClear(); router.replace.mockClear(); vi.restoreAllMocks();});

describe("Шаблони: тригерні й власні в одному списку", () => {
    it("lists the triggered templates unchanged and the custom ones of the channel, with a type column and filter", async () => {
        const calls = fakeServer("email", [subscription(FINISHED, "email"), subscription(REMINDER, "email", {Enabled: false})], [emailTemplate(1, FINISHED), emailTemplate(2, REMINDER)],
            [customTemplate(70, {Name: "Технічна перерва"}), customTemplate(71, {Name: "Лише в застосунку", Channels: ["in_app"]})]);
        wrap(<ManageEmailPage />);
        const table = screen.getByRole("table");
        const custom = (await within(table).findByRole("link", {name: "Технічна перерва"})).closest("tr")!;
        expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Шаблон", "Тип", "Статус", `Оновлено (${zoneOffset()})`, "Надсилати"]);
        expect(within(custom).getByText("Власний")).toBeTruthy();
        expect(within(custom).getByRole("link", {name: "Технічна перерва"}).getAttribute("href")).toBe(`/manage/email/custom/${uuid(70)}`);
        expect(within(custom).queryByRole("switch")).toBeNull();
        // An in-app-only custom template is not an email template.
        expect(within(table).queryByText("Лише в застосунку")).toBeNull();
        // The triggered rows keep their link, status and switch.
        const finished = within(table).getByRole("link", {name: "Захід завершено"}).closest("tr")!;
        expect(within(finished).getByText("За подією")).toBeTruthy();
        expect(within(finished).getByRole("link", {name: "Захід завершено"}).getAttribute("href")).toBe(`/manage/email/${FINISHED}`);
        expect((within(finished).getByRole("switch") as HTMLInputElement).checked).toBe(true);
        expect(screen.getByRole("link", {name: /Створити шаблон/}).getAttribute("href")).toBe("/manage/email/custom/new");

        fireEvent.pointerDown(screen.getByRole("button", {name: "Тип шаблону"}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "Власні"}));
        await waitFor(() => expect(within(table).queryByRole("link", {name: "Захід завершено"})).toBeNull());
        expect(within(table).getByRole("link", {name: "Технічна перерва"})).toBeTruthy();
        fireEvent.pointerDown(screen.getByRole("button", {name: "Тип шаблону"}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "За подією"}));
        await waitFor(() => expect(within(table).queryByRole("link", {name: "Технічна перерва"})).toBeNull());
        expect(within(table).getByRole("link", {name: "Нагадування про старт"})).toBeTruthy();

        // Toggling a triggered template sends exactly what it did before.
        fireEvent.click(within(table).getByRole("switch", {name: "Надсилати «Нагадування про старт» для цього заходу"}));
        await waitFor(() => expect(calls.some((call: Call) => call.method === "PUT")).toBe(true));
        expect(calls.find((call: Call) => call.method === "PUT")!.body).toEqual({SignalType: REMINDER, Channel: "email", Enabled: true, Audience: {kind: "all_participants"}});
    });

    it("shows the custom templates of the in-app channel on the in-app page", async () => {
        fakeServer("in_app", [subscription(FINISHED, "in_app")], [inAppTemplate(1)], [customTemplate(72, {Name: "Лише в застосунку", Channels: ["in_app"]}), customTemplate(73, {Name: "Лише лист", Channels: ["email"]})]);
        wrap(<ManageNotificationsPage />);
        const link = await screen.findByRole("link", {name: "Лише в застосунку"});
        expect(link.getAttribute("href")).toBe(`/manage/notifications/custom/${uuid(72)}`);
        expect(screen.queryByText("Лише лист")).toBeNull();
        expect(screen.getByRole("link", {name: "Захід завершено"})).toBeTruthy();
    });

    it("lets a viewer only look", async () => {
        manager.canManage = false;
        fakeServer("email", [subscription(FINISHED, "email")], [emailTemplate(1, FINISHED)], [customTemplate(74)]);
        wrap(<ManageEmailPage />);
        await screen.findByRole("link", {name: "Власний 74"});
        expect((screen.getByRole("button", {name: /Створити шаблон/}) as HTMLButtonElement).disabled).toBe(true);
    });
});

describe("Власний шаблон: редактор", () => {
    function server(extra?: (call: {method: string; path: string; body: unknown}) => unknown | Response | undefined) {
        const calls: {method: string; path: string; body: unknown}[] = [];
        globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input));
            const call = {method: init?.method ?? "GET", path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined};
            calls.push(call);
            const own = extra?.(call);
            if (own instanceof Response) return own;
            const data = own !== undefined ? own : call.path.endsWith("/presets") ? [] : call.path.includes("/preview") ? {Subject: "s", Preheader: "", HTML: "<p>x</p>"} : {};
            return new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
        }) as typeof fetch;
        return calls;
    }

    it("creates a custom template from the broadcast fields, starting on the page's channel", async () => {
        const calls = server(call => call.method === "POST" ? customTemplate(9, {Name: "Старт", Channels: ["in_app"], InAppTitle: "Старт о 10:00"}) : undefined);
        wrap(<CustomTemplateEditor channel="in_app" />);
        expect((screen.getByRole("checkbox", {name: "Електронна пошта"}) as HTMLInputElement).checked).toBe(false);
        expect((screen.getByRole("checkbox", {name: "У застосунку"}) as HTMLInputElement).checked).toBe(true);
        expect(screen.getByRole("link", {name: /Сповіщення на сайті/}).getAttribute("href")).toBe("/manage/notifications");
        const title = await screen.findByRole("textbox", {name: "Заголовок"});
        title.textContent = "Старт о 10:00";
        fireEvent.input(title);
        const save = screen.getByRole("button", {name: "Зберегти"});
        await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(save);
        const name = screen.getByRole("textbox", {name: /Назва шаблону/});
        expect(name.getAttribute("aria-invalid")).toBe("true");
        expect(document.getElementById(name.getAttribute("aria-describedby")!)?.textContent).toBe("Вкажіть назву шаблону.");
        fireEvent.change(name, {target: {value: " Старт "}});
        fireEvent.click(save);
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/manage/notifications/custom/${uuid(9)}`));
        const posted = calls.find(call => call.method === "POST")!;
        expect(posted.path).toBe(`/api/events/${EVENT_ID}/manage/notification-templates/custom`);
        expect(posted.body).toEqual({Name: "Старт", Channels: ["in_app"], Subject: "", Preheader: "", EmailBody: [], EmailStyling: {}, InAppTitle: "Старт о 10:00", InAppBody: "", InAppLink: ""});
    });

    it("saves an edit in place and shows a taken name beside the field", async () => {
        let puts = 0;
        const calls = server(call => {
            if (call.method === "GET" && call.path.endsWith(`/custom/${uuid(3)}`)) return customTemplate(3);
            if (call.method === "PUT") { puts += 1; return puts === 1 ? new Response(JSON.stringify({Status: {Code: 70228, Message: "taken"}}), {status: 409}) : customTemplate(3, {Name: "Інша назва"}); }
            return undefined;
        });
        wrap(<CustomTemplateEditor templateID={uuid(3)} channel="email" />);
        const name = await screen.findByRole("textbox", {name: /Назва шаблону/}) as HTMLInputElement;
        expect(name.value).toBe("Власний 3");
        fireEvent.change(name, {target: {value: "Зайнята"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(name.getAttribute("aria-invalid")).toBe("true"));
        expect(document.getElementById(name.getAttribute("aria-describedby")!)?.textContent).toBe("Шаблон з такою назвою вже є. Оберіть іншу назву.");
        fireEvent.change(name, {target: {value: "Інша назва"}});
        expect(name.getAttribute("aria-invalid")).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(screen.getByRole("heading", {name: "Інша назва"})).toBeTruthy());
        expect((calls.filter(call => call.method === "PUT").at(-1)!.body as Record<string, unknown>).Name).toBe("Інша назва");
        expect(router.replace).not.toHaveBeenCalled();
    });

    it("deletes after a danger confirmation and returns to the templates page", async () => {
        const calls = server(call => call.method === "GET" && call.path.endsWith(`/custom/${uuid(4)}`) ? customTemplate(4) : undefined);
        wrap(<CustomTemplateEditor templateID={uuid(4)} channel="email" />);
        fireEvent.click(await screen.findByRole("button", {name: "Видалити"}));
        const dialog = screen.getByText("Видалити власний шаблон?").closest("dialog")!;
        const confirm = within(dialog).getByRole("button", {name: "Видалити"});
        expect(confirm.className).toContain("ib-btn--danger-solid");
        expect(document.activeElement).toBe(within(dialog).getByRole("button", {name: "Скасувати"}));
        fireEvent.click(confirm);
        await waitFor(() => expect(router.push).toHaveBeenCalledWith("/manage/email"));
        expect(calls.some(call => call.method === "DELETE" && call.path.endsWith(`/notification-templates/custom/${uuid(4)}`))).toBe(true);
    });

    it("shows a load error with a retry and does not let a viewer edit", async () => {
        server(() => new Response("{}", {status: 404}));
        const view = wrap(<CustomTemplateEditor templateID={uuid(5)} channel="email" />);
        expect(await screen.findByText("Не вдалося завантажити шаблон")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
        view.unmount();
        manager.canManage = false;
        wrap(<CustomTemplateEditor templateID={uuid(5)} channel="email" />);
        expect(screen.getByText(/лише для перегляду/)).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Зберегти"})).toBeNull();
    });
});

describe("Власний шаблон: модель", () => {
    it("keeps exactly the template's channels and saves only their parts", () => {
        const message = templateMessage(customTemplate(6, {Channels: ["in_app"], Subject: "старе", InAppTitle: "Привіт"}) as never);
        expect(message.email).toBe(false);
        expect(message.inApp).toBe(true);
        expect(templateInput("  Назва ", message)).toEqual({Name: "Назва", Channels: ["in_app"], Subject: "", Preheader: "", EmailBody: [], EmailStyling: {}, InAppTitle: "Привіт", InAppBody: "", InAppLink: ""});
    });
});
