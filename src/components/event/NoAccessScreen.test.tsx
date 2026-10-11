// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {t} from "@/i18n/t";

vi.mock("@/utils/origins", () => ({idOrigin: "https://id.example.test", mainOrigin: "https://example.test", apiOrigin: "", eventOrigin: () => ""}));
const getCurrentUser = vi.fn();
vi.mock("@/api/clientAuth", () => ({getCurrentUser: () => getCurrentUser()}));
const auth = vi.hoisted(() => ({signOut: vi.fn()}));
vi.mock("@/api/authAPI", () => auth);
vi.mock("@/utils/signInRedirect", () => ({signInRedirectTarget: () => "#signed-out"}));

import {NoAccessScreen} from "./NoAccessScreen";

function renderScreen(title?: string) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><NoAccessScreen title={title} /></QueryClientProvider>);
}

afterEach(() => {cleanup(); getCurrentUser.mockReset(); auth.signOut.mockReset(); sessionStorage.clear();});

describe("NoAccessScreen", () => {
    it("clears this app's drafts after switching accounts", async () => {
        getCurrentUser.mockResolvedValue({ID: "u1", Email: "a@b.test"});
        auth.signOut.mockResolvedValue(undefined);
        sessionStorage.setItem("cib_manual_draft_private", "private edit");
        sessionStorage.setItem("other-app", "keep");
        renderScreen();
        fireEvent.click(await screen.findByRole("button", {name: "Увійти іншим обліковим записом"}));
        await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
        await waitFor(() => expect(Object.keys(sessionStorage)).toEqual(["other-app"]));
    });

    it("retains drafts when signing out fails", async () => {
        getCurrentUser.mockResolvedValue({ID: "u1", Email: "a@b.test"});
        auth.signOut.mockRejectedValue(new Error("offline"));
        sessionStorage.setItem("cib_manual_draft_private", "private edit");
        renderScreen();
        fireEvent.click(await screen.findByRole("button", {name: "Увійти іншим обліковим записом"}));
        await screen.findByText(new RegExp(t("account.signOutFailed")));
        expect(sessionStorage.getItem("cib_manual_draft_private")).toBe("private edit");
    });

    it("names the signed-in account and offers another account and home", async () => {
        getCurrentUser.mockResolvedValue({ID: "u1", Email: "a@b.test"});
        renderScreen();
        expect(await screen.findByRole("heading", {name: "Немає доступу"})).toBeTruthy();
        expect(screen.getByText("Ваш обліковий запис a@b.test не має доступу до цієї сторінки.")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Увійти іншим обліковим записом"})).toBeTruthy();
        expect(screen.getAllByRole("link", {name: "На головну"}).map(link => link.getAttribute("href"))).toEqual(["https://example.test", "https://example.test"]);
        expect(document.querySelector(".ib-error__code")?.textContent).toBe("403");
    });

    it("takes a page-specific title", async () => {
        getCurrentUser.mockResolvedValue({ID: "u1", Email: "a@b.test"});
        renderScreen("Немає доступу до панелі заходу");
        expect(await screen.findByRole("heading", {name: "Немає доступу до панелі заходу"})).toBeTruthy();
    });
});
