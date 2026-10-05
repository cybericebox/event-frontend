// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const getCurrentUser = vi.fn();
vi.mock("@/api/clientAuth", () => ({getCurrentUser: () => getCurrentUser()}));
vi.mock("./SignInRedirect", () => ({SignInRedirect: () => <div>sign-in redirect</div>}));
vi.mock("./EventBrandLogo", () => ({EventBrandLogo: () => <img alt="" data-testid="event-logo" />}));

import {EventNotFoundScreen} from "./EventNotFoundScreen";

function renderScreen(redirectVisitor = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><EventNotFoundScreen redirectVisitor={redirectVisitor} /></QueryClientProvider>);
}

afterEach(() => {cleanup(); getCurrentUser.mockReset();});

describe("EventNotFoundScreen", () => {
    it("says there is no such event, with the way to the platform and no event branding", () => {
        renderScreen();
        expect(screen.getByRole("heading", {name: "Такого заходу не існує"})).toBeTruthy();
        expect(screen.getByRole("link", {name: /^На головну Cyber\sICE\sBox$/})).toBeTruthy();
        expect(screen.queryByTestId("event-logo")).toBeNull();
        expect(document.title).toBe("Такого заходу не існує");
        expect(getCurrentUser).not.toHaveBeenCalled();
    });

    it("sends a visitor of a session-only page to the sign-in", async () => {
        getCurrentUser.mockResolvedValue(null);
        renderScreen(true);
        expect(await screen.findByText("sign-in redirect")).toBeTruthy();
    });

    it("shows a signed-in account of a session-only page the same screen", async () => {
        getCurrentUser.mockResolvedValue({ID: "u1"});
        renderScreen(true);
        expect(await screen.findByRole("heading", {name: "Такого заходу не існує"})).toBeTruthy();
    });
});
