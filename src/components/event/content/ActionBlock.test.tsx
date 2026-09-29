// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
vi.mock("@/utils/origins", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/utils/origins")>(),
    idOrigin: "https://id.cybericebox-dev.pp.ua",
    eventOrigin: (tag: string) => `https://${tag}.cybericebox-dev.pp.ua`,
}));
import {ActionBlock, joinState, registrationWindowOpen} from "./ActionBlock";

vi.mock("@/api/clientAuth", () => ({
    getCurrentUser: vi.fn(async () => null),
    getJoinStatus: vi.fn(async () => 0),
    getInvitationInfo: vi.fn(async () => ({Status: 0, Invited: false})),
    getParticipation: vi.fn(async () => null),
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
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        const props = {id: "cta", title: "", text: "", registrationOpen: true, joinPolicy: "rolling", startAt: "2026-09-28T10:00:00Z", finishAt: "", eventID: "event-1", eventTag: "games", actions: [{label: "Приєднатися", kind: "join_event" as const}, {label: "Правила", href: "/rules"}]};
        const {rerender} = render(<QueryClientProvider client={client}><ActionBlock {...props} /></QueryClientProvider>);
        await waitFor(() => expect(screen.getByRole("link", {name: "Приєднатися"}).getAttribute("href")).toContain("/sign-in?return_to="));
        rerender(<QueryClientProvider client={client}><ActionBlock {...props} registrationOpen={false} /></QueryClientProvider>);
        expect(screen.queryByRole("link", {name: "Приєднатися"})).toBeNull();
        expect(screen.getByRole("link", {name: "Правила"}).className).toContain("ib-btn--primary");
    });
});

describe("join action states", () => {
    const base = {windowOpen: true, timeWindowOpen: true, signInHref: "https://id.example/sign-in"};
    it("shows the status of the visitor's application instead of hiding the button", () => {
        expect(joinState({...base, identity: "guest"})).toEqual({kind: "join", href: "https://id.example/sign-in"});
        expect(joinState({...base, identity: "user", status: 0})).toEqual({kind: "join", href: "/join"});
        expect(joinState({...base, identity: "user", status: 1, invitation: {Invited: false}})).toEqual({kind: "pending"});
        expect(joinState({...base, identity: "user", status: 1, invitation: {Invited: true}})).toEqual({kind: "invite"});
        expect(joinState({...base, identity: "user", status: 1, invitation: {Invited: true, InvitationExpired: true}})).toEqual({kind: "hidden"});
        expect(joinState({...base, identity: "user", status: 2})).toEqual({kind: "approved"});
        expect(joinState({...base, identity: "user", status: 3})).toEqual({kind: "rejected"});
    });

    it("hides the button when registration is closed and keeps space while loading", () => {
        expect(joinState({...base, windowOpen: false, identity: "guest"})).toEqual({kind: "hidden"});
        expect(joinState({...base, windowOpen: false, identity: "user", status: 0})).toEqual({kind: "hidden"});
        expect(joinState({...base, windowOpen: false, identity: "user", status: 2})).toEqual({kind: "approved"});
        expect(joinState({...base, identity: "loading"})).toEqual({kind: "loading"});
        expect(joinState({...base, identity: "user", status: "loading"})).toEqual({kind: "loading"});
    });

    it("follows the server's verdict for a signed-in visitor: staff never see the join button, whatever the window says", () => {
        expect(joinState({...base, identity: "user", status: 0, registerAllowed: false})).toEqual({kind: "hidden"});
        expect(joinState({...base, windowOpen: false, identity: "user", status: 0, registerAllowed: true})).toEqual({kind: "join", href: "/join"});
        expect(joinState({...base, identity: "user", status: 0, registerAllowed: "loading"})).toEqual({kind: "loading"});
        // Someone who already applied keeps their status even when registration is no longer allowed.
        expect(joinState({...base, identity: "user", status: 2, registerAllowed: false})).toEqual({kind: "approved"});
    });

    it("hides the join button from event staff", async () => {
        const {getJoinStatus, getCurrentUser, getParticipation} = await import("@/api/clientAuth");
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ID: "u", FirstName: "", LastName: "", Email: ""} as never);
        vi.mocked(getJoinStatus).mockResolvedValueOnce(0);
        vi.mocked(getParticipation).mockResolvedValueOnce({Staff: true, Register: {Allowed: false, Reason: "staff_cannot_participate"}} as never);
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><ActionBlock id="cta" title="" text="" registrationOpen joinPolicy="rolling" startAt="" finishAt="" eventID="event-3" eventTag="games" actions={[{label: "Зареєструватися", kind: "join_event"}, {label: "Правила", href: "/rules"}]} /></QueryClientProvider>);
        await waitFor(() => expect(screen.queryByText("Зареєструватися")).toBeNull());
        expect(screen.getByRole("link", {name: "Правила"})).toBeTruthy();
    });

    it("previews the button for each viewer without requests", () => {
        expect(joinState({...base, preview: "guest", identity: "loading"})).toEqual({kind: "join", href: "/join"});
        expect(joinState({...base, preview: "participant", identity: "loading"})).toEqual({kind: "approved"});
        expect(joinState({...base, preview: "moderator", windowOpen: false, identity: "loading"})).toEqual({kind: "hidden"});
    });

    it("renders pending as a status without a link", async () => {
        const {getJoinStatus, getCurrentUser, getInvitationInfo} = await import("@/api/clientAuth");
        vi.mocked(getCurrentUser).mockResolvedValueOnce({ID: "u", FirstName: "", LastName: "", Email: ""} as never);
        vi.mocked(getJoinStatus).mockResolvedValueOnce(1);
        vi.mocked(getInvitationInfo).mockResolvedValueOnce({Status: 1, Invited: false} as never);
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><ActionBlock id="cta" title="" text="" registrationOpen joinPolicy="rolling" startAt="" finishAt="" eventID="event-2" eventTag="games" actions={[{label: "Зареєструватися", kind: "join_event"}]} /></QueryClientProvider>);
        await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Заявка на розгляді"));
        expect(screen.queryByRole("link")).toBeNull();
    });
});
