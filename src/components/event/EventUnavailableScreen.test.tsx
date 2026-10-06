// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

vi.mock("./EventBrandLogo", () => ({EventBrandLogo: () => <img alt="" data-testid="event-logo" />, useEventBrandName: () => "Кубок CTF"}));
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
    it("is the 404 error page: two-line title, no event branding even inside an event, the platform crest in the footer", async () => {
        getCurrentUser.mockResolvedValue(null);
        const {container} = render(<QueryClientProvider client={new QueryClient()}><EventUnavailableScreen /></QueryClientProvider>);
        expect(screen.getByRole("heading", {name: "Захід не знайдено або у вас немає доступу"})).toBeTruthy();
        expect(container.querySelectorAll(".ib-error__line")).toHaveLength(2);
        expect(container.querySelector(".ib-error__code")?.textContent).toBe("404");
        expect(container.querySelector(".ib-error--page main#main")).toBeTruthy();
        expect(screen.queryByTestId("event-logo")).toBeNull();
        expect(screen.queryByText("Кубок CTF")).toBeNull();
        expect(container.querySelector(".ib-error__brand")?.textContent).toBe("Cyber\u00A0ICE\u00A0Box");
        expect(document.title).toBe("Захід не знайдено або у вас немає доступу");
    });

    it("offers a single secondary «Увійти» without a session", async () => {
        getCurrentUser.mockResolvedValue(null);
        const {container} = render(<QueryClientProvider client={new QueryClient()}><EventUnavailableScreen /></QueryClientProvider>);
        const signIn = await screen.findByRole("link", {name: "Увійти"});
        expect(signIn.className).toBe("ib-btn");
        expect(container.querySelector(".ib-error__actions")?.children).toHaveLength(1);
        expect(container.querySelector(".ib-btn--primary")).toBeNull();
    });

    it("offers no sign-in to an account that is already signed in", async () => {
        getCurrentUser.mockResolvedValue({ID: "u1", Email: "a@b.test"});
        const {container} = render(<QueryClientProvider client={new QueryClient()}><EventUnavailableScreen /></QueryClientProvider>);
        await vi.waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(screen.queryByRole("link", {name: "Увійти"})).toBeNull();
        expect(container.querySelector(".ib-error__actions")).toBeNull();
    });

    it("offers no sign-in when the session check fails with a server answer", async () => {
        getCurrentUser.mockRejectedValue(Object.assign(new Error("500"), {status: 500}));
        renderScreen();
        await vi.waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(screen.queryByRole("link", {name: "Увійти"})).toBeNull();
    });

    it("offers the sign-in when the session check cannot reach the API", async () => {
        getCurrentUser.mockRejectedValue(new TypeError("Failed to fetch"));
        renderScreen();
        expect(await screen.findByRole("link", {name: "Увійти"})).toBeTruthy();
    });
});
