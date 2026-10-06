// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

vi.mock("@/utils/origins", () => ({idOrigin: "https://id.example.test", mainOrigin: "https://example.test", apiOrigin: "", eventOrigin: () => ""}));
const getCurrentUser = vi.fn();
vi.mock("@/api/clientAuth", () => ({getCurrentUser: () => getCurrentUser()}));
vi.mock("@/api/authAPI", () => ({signOut: vi.fn()}));

import {NoAccessScreen} from "./NoAccessScreen";

function renderScreen(title?: string) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><NoAccessScreen title={title} /></QueryClientProvider>);
}

afterEach(() => {cleanup(); getCurrentUser.mockReset();});

describe("NoAccessScreen", () => {
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
