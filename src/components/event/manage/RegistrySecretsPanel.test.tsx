// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

let canManage = true;
vi.mock("./ManagerShell", () => ({useManager: () => ({event: {EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

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
});
