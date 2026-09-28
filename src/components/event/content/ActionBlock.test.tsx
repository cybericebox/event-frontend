// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ActionBlock, registrationWindowOpen} from "./ActionBlock";

vi.mock("@/api/clientAuth", () => ({
    getCurrentUser: vi.fn(async () => null),
    getJoinStatus: vi.fn(async () => 0),
    getInvitationInfo: vi.fn(async () => ({Status: 0, Invited: false})),
}));

afterEach(cleanup);

describe("registration action", () => {
    it("closes locally at start for locked registration and at finish for rolling registration", () => {
        const start = "2026-09-28T10:00:00Z";
        const finish = "2026-09-28T12:00:00Z";
        expect(registrationWindowOpen(true, "locked_at_start", start, finish, Date.parse(start) - 1)).toBe(true);
        expect(registrationWindowOpen(true, "locked_at_start", start, finish, Date.parse(start))).toBe(false);
        expect(registrationWindowOpen(true, "rolling", start, finish, Date.parse(start))).toBe(true);
        expect(registrationWindowOpen(true, "rolling", start, finish, Date.parse(finish))).toBe(false);
    });

    it("shows a login route for guests and promotes the remaining link when registration closes", async () => {
        vi.stubEnv("NEXT_PUBLIC_DOMAIN", "cybericebox-dev.pp.ua");
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        const props = {id: "cta", title: "", text: "", registrationOpen: true, joinPolicy: "rolling", startAt: "2026-09-28T10:00:00Z", finishAt: "", eventID: "event-1", eventTag: "games", actions: [{label: "Приєднатися", kind: "join_event" as const}, {label: "Правила", href: "/rules"}]};
        const {rerender} = render(<QueryClientProvider client={client}><ActionBlock {...props} /></QueryClientProvider>);
        await waitFor(() => expect(screen.getByRole("link", {name: "Приєднатися"}).getAttribute("href")).toContain("/sign-in?return_to="));
        rerender(<QueryClientProvider client={client}><ActionBlock {...props} registrationOpen={false} /></QueryClientProvider>);
        expect(screen.queryByRole("link", {name: "Приєднатися"})).toBeNull();
        expect(screen.getByRole("link", {name: "Правила"}).className).toContain("ib-btn--primary");
        vi.unstubAllEnvs();
    });
});
