// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

let canManage = true;
vi.mock("./ManagerShell", () => ({useManager: () => ({event: {EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import uk from "../../../../messages/uk.json";
import {RegistrySecretsPanel} from "./RegistrySecretsPanel";

const secret = {ID: "s1", Host: "ghcr.io", RepositoryPrefix: "acme", Username: "robot", UpdatedAt: "2026-10-01T10:00:00Z"};
const requests: {method: string; url: string; body: unknown}[] = [];

function mockApi(list: unknown[], failWith?: {code: number}) {
    requests.length = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const url = String(input);
        requests.push({method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined});
        if (method !== "GET" && failWith) return new Response(JSON.stringify({Status: {Code: failWith.code, Message: "x"}}), {status: 409});
        if (method === "DELETE") return new Response(JSON.stringify({Status: {Code: 0}, Data: {}}), {status: 200});
        if (method === "POST") return new Response(JSON.stringify({Status: {Code: 0}, Data: {...secret, ID: "s2", Host: "docker.io", RepositoryPrefix: "", Username: "bob"}}), {status: 200});
        if (method === "PUT") return new Response(JSON.stringify({Status: {Code: 0}, Data: {...secret, Username: "robot2"}}), {status: 200});
        return new Response(JSON.stringify({Status: {Code: 0}, Data: list}), {status: 200});
    }) as typeof fetch;
}

function renderPanel() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><RegistrySecretsPanel /></QueryClientProvider>);
}

beforeEach(() => {
    canManage = true;
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {this.setAttribute("open", "");};
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {this.removeAttribute("open");};
});
afterEach(cleanup);

describe("Реєстри образів заходу", () => {
    it("shows the empty state when there are no secrets", async () => {
        mockApi([]);
        renderPanel();
        expect(await screen.findByText("Облікових даних реєстрів ще немає.")).toBeTruthy();
    });

    it("lists host, prefix and user and never renders a token back", async () => {
        mockApi([{...secret, Token: "ghp_LEAKED"}]);
        const {container} = renderPanel();
        expect(await screen.findByText("ghcr.io")).toBeTruthy();
        expect(screen.getByText(/acme/)).toBeTruthy();
        expect(screen.getByText(/robot/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
        const token = await screen.findByLabelText(/^Токен/) as HTMLInputElement;
        expect(token.value).toBe("");
        expect(token.placeholder).toBe("Токен збережено");
        expect(container.innerHTML).not.toContain("ghp_LEAKED");
    });

    it("takes the example placeholders from the messages and keeps password managers off the credentials", async () => {
        mockApi([]);
        renderPanel();
        await screen.findByText("Облікових даних реєстрів ще немає.");
        fireEvent.click(screen.getByRole("button", {name: "Додати"}));
        const messages = uk as Record<string, string>;
        expect((screen.getByLabelText(/^Адреса реєстру/) as HTMLInputElement).placeholder).toBe(messages["manage.registries.field.hostPlaceholder"]);
        expect((screen.getByLabelText(/^Префікс репозиторію/) as HTMLInputElement).placeholder).toBe(messages["manage.registries.field.prefixPlaceholder"]);
        for (const field of [screen.getByLabelText(/^Токен/), screen.getByLabelText(/^Користувач/)]) {
            expect(field.getAttribute("autocomplete")).toBe("off");
            expect(field.hasAttribute("data-1p-ignore")).toBe(true);
            expect(field.getAttribute("data-lpignore")).toBe("true");
        }
    });

    it("has no show button on the token field", async () => {
        mockApi([]);
        renderPanel();
        await screen.findByText("Облікових даних реєстрів ще немає.");
        fireEvent.click(screen.getByRole("button", {name: "Додати"}));
        expect((screen.getByLabelText(/^Токен/) as HTMLInputElement).type).toBe("password");
        expect(screen.queryByRole("button", {name: "Показати"})).toBeNull();
        const form = screen.getByLabelText(/^Адреса реєстру/).closest("form")!;
        expect(within(form).getByRole("button", {name: "Скасувати"}).parentElement).toBe(within(form).getByRole("button", {name: "Зберегти"}).parentElement);
    });

    it("adds a secret with a write-only token and puts it in the list without refetching", async () => {
        mockApi([secret]);
        renderPanel();
        await screen.findByText("ghcr.io");
        fireEvent.click(screen.getByRole("button", {name: "Додати"}));
        fireEvent.change(screen.getByLabelText(/^Адреса реєстру/), {target: {value: "docker.io"}});
        fireEvent.change(screen.getByLabelText(/^Користувач/), {target: {value: "bob"}});
        fireEvent.change(screen.getByLabelText(/^Токен/), {target: {value: "dckr_pat"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(requests.some(request => request.method === "POST")).toBe(true));
        expect(requests.find(request => request.method === "POST")?.body).toEqual({Host: "docker.io", RepositoryPrefix: "", Username: "bob", Token: "dckr_pat"});
        expect(await screen.findByText("docker.io")).toBeTruthy();
        expect(requests.filter(request => request.method === "GET")).toHaveLength(1);
        expect((screen.queryByText("dckr_pat"))).toBeNull();
    });

    it("keeps the stored token when an edit leaves it empty", async () => {
        mockApi([secret]);
        renderPanel();
        await screen.findByText("ghcr.io");
        fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
        fireEvent.change(await screen.findByLabelText(/^Користувач/), {target: {value: "robot2"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(requests.some(request => request.method === "PUT")).toBe(true));
        expect(requests.find(request => request.method === "PUT")?.body).toEqual({Host: "ghcr.io", RepositoryPrefix: "acme", Username: "robot2", Token: ""});
        expect(requests.find(request => request.method === "PUT")?.url).toContain("/registry-secrets/s1");
    });

    it("asks for the token again when the host changes", async () => {
        mockApi([secret]);
        renderPanel();
        await screen.findByText("ghcr.io");
        fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
        fireEvent.change(await screen.findByLabelText(/^Адреса реєстру/), {target: {value: "quay.io"}});
        expect(screen.getByText("Змінили адресу реєстру: введіть токен знову.")).toBeTruthy();
        expect((screen.getByRole("button", {name: "Зберегти"}) as HTMLButtonElement).disabled).toBe(true);
    });

    it("confirms before deleting and removes the row", async () => {
        mockApi([secret]);
        renderPanel();
        await screen.findByText("ghcr.io");
        fireEvent.click(screen.getByRole("button", {name: "Видалити"}));
        const dialog = await screen.findByRole("alertdialog", {hidden: true});
        expect(within(dialog).getByText("Видалити облікові дані для ghcr.io?")).toBeTruthy();
        expect(requests.some(request => request.method === "DELETE")).toBe(false);
        fireEvent.click(within(dialog).getByRole("button", {name: "Видалити", hidden: true}));
        await waitFor(() => expect(requests.some(request => request.method === "DELETE" && request.url.endsWith("/registry-secrets/s1"))).toBe(true));
        await waitFor(() => expect(screen.getByText("Облікових даних реєстрів ще немає.")).toBeTruthy());
    });

    it("shows a duplicate rejection inline and keeps the form open", async () => {
        mockApi([secret], {code: 72814});
        renderPanel();
        await screen.findByText("ghcr.io");
        fireEvent.click(screen.getByRole("button", {name: "Додати"}));
        fireEvent.change(screen.getByLabelText(/^Адреса реєстру/), {target: {value: "ghcr.io"}});
        fireEvent.change(screen.getByLabelText(/^Користувач/), {target: {value: "bob"}});
        fireEvent.change(screen.getByLabelText(/^Токен/), {target: {value: "t"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        const form = screen.getByLabelText(/^Адреса реєстру/).closest("form")!;
        await waitFor(() => expect(within(form).getByRole("alert").textContent).toContain("вже збережено доступ"));
        expect((screen.getByLabelText(/^Адреса реєстру/) as HTMLInputElement).value).toBe("ghcr.io");
    });

    it("shows the token-required rejection next to the token field", async () => {
        mockApi([secret], {code: 22815});
        renderPanel();
        await screen.findByText("ghcr.io");
        fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
        fireEvent.change(await screen.findByLabelText(/^Користувач/), {target: {value: "robot2"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        const token = screen.getByLabelText(/^Токен/);
        await waitFor(() => expect(token.closest(".event-manage-field")!.querySelector("[role=alert]")?.textContent).toContain("Введіть токен ще раз"));
    });

      it("shows the empty-token rejection (2825) next to the token field", async () => {
        mockApi([secret], {code: 22825});
        renderPanel();
        await screen.findByText("ghcr.io");
        fireEvent.click(screen.getByRole("button", {name: "Додати"}));
        fireEvent.change(screen.getByLabelText(/^Адреса реєстру/), {target: {value: "docker.io"}});
        fireEvent.change(screen.getByLabelText(/^Користувач/), {target: {value: "bob"}});
        fireEvent.change(screen.getByLabelText(/^Токен/), {target: {value: "t"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        const token = screen.getByLabelText(/^Токен/);
        await waitFor(() => expect(token.closest(".event-manage-field")!.querySelector("[role=alert]")?.textContent).toContain("Введіть токен реєстру образів"));
    });

    it.each([72826, 72827])("shows the missing secrets key (%i) as a form error, not at the token field", async code => {
        mockApi([secret], {code});
        renderPanel();
        await screen.findByText("ghcr.io");
        fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
        fireEvent.change(await screen.findByLabelText(/^Токен/), {target: {value: "new"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        const form = screen.getByLabelText(/^Адреса реєстру/).closest("form")!;
        await waitFor(() => expect(within(form).getByRole("alert").textContent).toContain("Сховище секретів не налаштоване"));
        expect(screen.getByLabelText(/^Токен/).closest(".event-manage-field")!.querySelector("[role=alert]")).toBeNull();
    });

  it("is read-only for viewers", async () => {
        canManage = false;
        mockApi([secret]);
        renderPanel();
        await screen.findByText("ghcr.io");
        expect(screen.getByText("Доступний лише перегляд.")).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Додати"})).toBeNull();
        expect(screen.queryByRole("button", {name: "Редагувати"})).toBeNull();
        expect(screen.queryByRole("button", {name: "Видалити"})).toBeNull();
    });

    describe("credential check", () => {
        const ok = {State: "ok", CheckedAt: "2026-10-18T09:00:00Z", Reason: "", AttemptedAt: "2026-10-18T09:00:00Z", Failure: ""};
        const broken = {State: "broken", CheckedAt: "2026-10-18T09:00:00Z", Reason: "unauthorized", AttemptedAt: "2026-10-18T09:00:00Z", Failure: ""};

        // Answers the list, and a check of s1 with the given result (held until released, to see the busy state).
        function mockCheckApi(list: unknown[], result: unknown, hold?: Promise<void>) {
            requests.length = 0;
            globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
                const method = init?.method ?? "GET";
                const url = String(input);
                requests.push({method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined});
                if (method === "POST" && url.endsWith("/check")) {
                    await hold;
                    return new Response(JSON.stringify({Status: {Code: 0}, Data: {...secret, Check: result}}), {status: 200});
                }
                if (method === "PUT") return new Response(JSON.stringify({Status: {Code: 0}, Data: {...secret, Username: "robot2"}}), {status: 200});
                return new Response(JSON.stringify({Status: {Code: 0}, Data: list}), {status: 200});
            }) as typeof fetch;
        }

        it("says when a secret was never checked, works, or does not work and why", async () => {
            mockApi([{...secret, ID: "a", Host: "never.example"}, {...secret, ID: "b", Host: "good.example", Check: ok}, {...secret, ID: "c", Host: "bad.example", Check: broken}]);
            renderPanel();
            await screen.findByText("never.example");
            expect(screen.getByText("Ще не перевірено")).toBeTruthy();
            expect(screen.getByText(/Перевірено: .+ — працює/)).toBeTruthy();
            expect(screen.getByText(/Перевірено: .+ — не працює: реєстр відхилив токен/)).toBeTruthy();
        });

        it("names a missing repository as the reason", async () => {
            mockApi([{...secret, Check: {...broken, Reason: "not_found"}}]);
            renderPanel();
            expect(await screen.findByText(/не працює: репозиторій не знайдено/)).toBeTruthy();
        });

        it("tells a failed attempt will be retried while the previous state stays", async () => {
            mockApi([{...secret, Check: {...ok, AttemptedAt: "2026-10-18T15:00:00Z", Failure: "rate_limited"}}]);
            renderPanel();
            expect(await screen.findByText(/Перевірено: .+ — працює/)).toBeTruthy();
            expect(screen.getByText(/Остання спроба .+ не вдалася \(реєстр обмежив кількість запитів\), її буде повторено/)).toBeTruthy();
        });

        it("checks now: only its own button is busy, the row updates without a refetch", async () => {
            let release!: () => void;
            mockCheckApi([secret, {...secret, ID: "s9", Host: "other.example"}], broken, new Promise<void>(resolve => {release = resolve;}));
            renderPanel();
            await screen.findByText("ghcr.io");
            const buttons = screen.getAllByRole("button", {name: /Перевірити зараз/});
            fireEvent.click(buttons[0]);
            await waitFor(() => expect((screen.getByRole("button", {name: "Перевіряємо…"}) as HTMLButtonElement).disabled).toBe(true));
            expect(screen.getAllByRole("button", {name: /Перевірити зараз/})).toHaveLength(1);
            expect((screen.getByRole("button", {name: /Перевірити зараз/}) as HTMLButtonElement).disabled).toBe(false);
            expect((screen.getAllByRole("button", {name: "Редагувати"})[0] as HTMLButtonElement).disabled).toBe(false);
            release();
            expect(await screen.findByText(/не працює: реєстр відхилив токен/)).toBeTruthy();
            expect(requests.find(request => request.method === "POST")?.url).toContain("/registry-secrets/s1/check");
            expect(requests.filter(request => request.method === "GET")).toHaveLength(1);
        });

        it("shows a failed check call at its row", async () => {
            mockApi([secret], {code: 5000});
            renderPanel();
            await screen.findByText("ghcr.io");
            fireEvent.click(screen.getByRole("button", {name: /Перевірити зараз/}));
            const alert = await screen.findByRole("alert");
            expect(alert.closest("li")?.textContent).toContain("ghcr.io");
        });

        it("checks a saved secret at once, without a toast or a button press", async () => {
            mockCheckApi([secret], ok);
            renderPanel();
            await screen.findByText("ghcr.io");
            fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
            fireEvent.change(await screen.findByLabelText(/^Користувач/), {target: {value: "robot2"}});
            fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
            await waitFor(() => expect(requests.some(request => request.method === "POST" && request.url.endsWith("/registry-secrets/s1/check"))).toBe(true));
        });

        it("offers no check to viewers but shows the status", async () => {
            canManage = false;
            mockApi([{...secret, Check: ok}]);
            renderPanel();
            await screen.findByText("ghcr.io");
            expect(screen.getByText(/працює/)).toBeTruthy();
            expect(screen.queryByRole("button", {name: /Перевірити зараз/})).toBeNull();
        });
    });
});
