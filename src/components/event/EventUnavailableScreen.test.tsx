// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

vi.mock("./EventBrandLogo", () => ({EventBrandLogo: () => <img alt="" data-testid="event-logo" />}));
vi.mock("@/utils/origins", () => ({idOrigin: "https://id.example.test", mainOrigin: "https://example.test", apiOrigin: "", eventOrigin: () => ""}));
const getCurrentUser = vi.fn();
vi.mock("@/api/clientAuth", () => ({getCurrentUser: () => getCurrentUser()}));

import {EventUnavailableScreen} from "./EventUnavailableScreen";

function renderScreen() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><EventUnavailableScreen /></QueryClientProvider>);
}

afterEach(() => {cleanup(); getCurrentUser.mockReset();});

describe("EventUnavailableScreen", () => {
    it("says the event is not found or not accessible, with no event branding and no link home", async () => {
        getCurrentUser.mockResolvedValue(null);
        renderScreen();
        expect(screen.getByRole("heading", {name: "Захід не знайдено або у вас немає доступу"})).toBeTruthy();
        expect(screen.queryByTestId("event-logo")).toBeNull();
        expect(screen.queryByRole("link", {name: /Cyber/})).toBeNull();
        expect(document.title).toBe("Захід не знайдено або у вас немає доступу");
        expect(await screen.findByRole("link", {name: "Увійти"})).toBeTruthy();
        expect(screen.getAllByRole("link")).toHaveLength(1);
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("is one compact card under a brand line, in the page's main", async () => {
        getCurrentUser.mockResolvedValue(null);
        const {container} = render(<QueryClientProvider client={new QueryClient()}><EventUnavailableScreen /></QueryClientProvider>);
        const main = container.querySelector("main#main");
        expect(main).toBeTruthy();
        expect(main!.querySelectorAll("h1")).toHaveLength(1);
        expect(main!.querySelector(".event-error__head")).toBeTruthy();
        const card = main!.querySelector(".event-error__card")!;
        expect(card.querySelector("h1")).toBeTruthy();
        expect(await screen.findByRole("link", {name: "Увійти"})).toBeTruthy();
        expect(card.contains(screen.getByRole("link", {name: "Увійти"}))).toBe(true);
    });

    it("offers no sign-in to an account that is already signed in", async () => {
        getCurrentUser.mockResolvedValue({ID: "u1", Email: "a@b.test"});
        renderScreen();
        await screen.findByRole("heading", {name: "Захід не знайдено або у вас немає доступу"});
        await vi.waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
        expect(screen.queryByRole("link", {name: "Увійти"})).toBeNull();
    });

    it("offers the sign-in when the session check cannot reach the API", async () => {
        getCurrentUser.mockRejectedValue(new TypeError("Failed to fetch"));
        renderScreen();
        expect(await screen.findByRole("link", {name: "Увійти"})).toBeTruthy();
    });
});
