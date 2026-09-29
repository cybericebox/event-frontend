// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const getCurrentUser = vi.fn();
vi.mock("@/api/clientAuth", () => ({getCurrentUser: () => getCurrentUser()}));

import {EventNotFoundScreen} from "./EventNotFoundScreen";

function renderScreen() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><EventNotFoundScreen /></QueryClientProvider>);
}

afterEach(() => {cleanup(); getCurrentUser.mockReset();});

describe("EventNotFoundScreen", () => {
    it("offers a visitor the sign-in and the way home", async () => {
        getCurrentUser.mockResolvedValue(null);
        renderScreen();
        expect(await screen.findByRole("heading", {name: "Захід не знайдено"})).toBeTruthy();
        expect(screen.getByRole("link", {name: "Увійти"}).getAttribute("href")).toContain("/sign-in");
        expect(screen.getByRole("link", {name: "На головну Cyber ICE Box"})).toBeTruthy();
    });

    it("tells a signed-in account it has no access", async () => {
        getCurrentUser.mockResolvedValue({ID: "u1"});
        renderScreen();
        expect(await screen.findByRole("heading", {name: "Захід недоступний"})).toBeTruthy();
        expect(screen.queryByRole("link", {name: "Увійти"})).toBeNull();
    });
});
