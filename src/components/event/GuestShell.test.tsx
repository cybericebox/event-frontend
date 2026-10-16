// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ParticipantShell} from "./ParticipantShell";
import {GuestShell} from "./GuestShell";

const route = vi.hoisted(() => ({pathname: "/p/rules"}));
vi.mock("next/navigation", () => ({usePathname: () => route.pathname}));
vi.mock("./EventNavigation", () => ({EventNavbar: () => <nav aria-label="Event navigation" />}));

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Tag: "test", Name: "Test",
    StartTime: "2026-09-28T00:00:00Z", FinishTime: null, Status: 2,
    Participation: 0, Registration: 1, CanViewResults: false, CanViewParticipants: false,
    PreviewDescription: "", PreviewPicture: "", LogoURL: "", FaviconURL: "",
    ShowStartCountdown: true, ShowFinishCountdown: true, FinishCountdownMinutes: 10,
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} satisfies PublicEventInfo;

afterEach(cleanup);

function shell(authenticated: boolean, pending = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
    client.setQueryData(["site-banners", event.EventID], []);
    return render(<QueryClientProvider client={client}><GuestShell event={event} authenticated={authenticated} pending={pending}><p>Public page</p></GuestShell></QueryClientProvider>);
}

it.each(["/", "/p/rules", "/faq"])("keeps the footer theme chooser on guest page %s", pathname => {
    route.pathname = pathname;
    shell(false);
    expect(screen.getByRole("radiogroup", {name: "Тема оформлення"}).closest("footer")).toBeTruthy();
});

it("omits the external theme chooser for signed-in custom-page visitors", () => {
    route.pathname = "/p/rules";
    shell(true);
    expect(screen.queryByRole("radiogroup")).toBeNull();
});

it("does not flash a guest theme chooser while authentication is pending", () => {
    route.pathname = "/p/rules";
    shell(false, true);
    expect(screen.queryByRole("radiogroup")).toBeNull();
});

it.each(["guest", "participant"])("places announcements before navigation in the %s shell", async kind => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
    client.setQueryData(["site-banners", event.EventID], [{ID: "b1", Text: "Announcement", Level: "info", LinkURL: "", LinkLabel: "", Dismissible: false, Version: 1}]);
    const content = <p>Page content</p>;
    render(<QueryClientProvider client={client}>{kind === "guest"
        ? <GuestShell event={event} authenticated={false}>{content}</GuestShell>
        : <ParticipantShell event={event} participantInfo={{HasInfrastructureChallenges: false} as never} ownTeam={null}>{content}</ParticipantShell>}
    </QueryClientProvider>);
    const announcement = await screen.findByText("Announcement");
    const navigation = screen.getByRole("navigation", {name: "Event navigation"});
    expect(announcement.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
