import {renderToString} from "react-dom/server";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {expect, it, vi} from "vitest";
vi.mock("next/navigation", () => ({usePathname: () => "/", useRouter: () => ({push: vi.fn()})}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: async () => null}));
vi.mock("./GuestShell", () => ({GuestShell: ({notice, children}: {notice?: unknown; children: unknown}) => <div>{notice as never}{children as never}</div>}));
import {ParticipantPreviewProvider} from "./ParticipantPreview";
import {PrivateEventBootstrap} from "./PrivateEventBootstrap";

const event = {EventID: "event-1", Name: "Hidden", LogoURL: "", FaviconURL: "", Theme: {Brand: "#1", AccentLight: "#2", AccentDark: "#3", AccentLive: "#4"}} as never;
const html = (serverCookie: string | null) => renderToString(<QueryClientProvider client={new QueryClient()}>
    <ParticipantPreviewProvider serverCookie={serverCookie}><PrivateEventBootstrap initialEvent={event}><main>page</main></PrivateEventBootstrap></ParticipantPreviewProvider>
</QueryClientProvider>);

it("server render with the preview cookie has no staff line or edit button", () => {
    const out = html("event-1");
    expect(out).not.toContain("Попередній перегляд. Сторінка ще недоступна відвідувачам.");
    expect(out).not.toContain("Редагувати головну");
    expect(out).toContain("page");
});
it("without the cookie, or with another event's cookie, a staff user sees them as before", () => {
    for (const cookie of [null, "event-2"]) {
        const out = html(cookie);
        expect(out).toContain("Попередній перегляд. Сторінка ще недоступна відвідувачам.");
        expect(out).toContain("Редагувати головну");
    }
});
