// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ownBoardSchema} from "@/api/participantChallenges";
import {completedLab, runningLab, runtimeFixture} from "@/test/labLifecycle";
import {fixtureChallenge} from "./fixtures/challengeFixture";

const runtimeAPI = vi.hoisted(() => vi.fn());
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: true, openVpn: () => {}})}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/api/participantChallenges", async importOriginal => ({
    ...await importOriginal<typeof import("@/api/participantChallenges")>(),
    getOwnChallengeLab: () => runtimeAPI() ?? Promise.resolve(runtimeFixture),
}));

const {ChallengeModal} = await import("./ChallengeModal");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => {cleanup(); runtimeAPI.mockReset();});

const text = (value: string) => ({type: "text", text: value, format: 0});
const variable = (name: string) => ({type: "variable", varName: name});
const challenge = {
    ...fixtureChallenge,
    Snapshot: {
        ...fixtureChallenge.Snapshot,
        description: {root: {type: "root", children: [{type: "paragraph", children: [text("Відкрийте "), variable("ph_link"), text(" або "), variable("ph_plain"), {type: "link", url: "https://organizer.test/help", children: [text("Довідка")]}]}]}},
        placeholders: [
            {key: "ph_link", kind: "ip", ip_reference: "vpn", last_octet: 5, as_link: true, scheme: "https", port: 8443, path: "/panel"},
            {key: "ph_plain", kind: "ip", ip_reference: "vpn", last_octet: 6},
        ],
    },
};

describe("challenge description placeholders", () => {
    it("shows a link-form IP as a working new-tab link and a plain IP as text", async () => {
        const {container} = render(<QueryClientProvider client={new QueryClient()}>
            <ChallengeModal challenge={challenge} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints hintChargeMode="reward" onClose={() => {}} onAccepted={() => {}} />
        </QueryClientProvider>);
        const link = await screen.findByRole("link", {name: "https://10.128.1.5:8443/panel"}) as HTMLAnchorElement;
        expect(link.getAttribute("href")).toBe("https://10.128.1.5:8443/panel");
        expect(link.target).toBe("_blank");
        expect(link.rel).toBe("noopener noreferrer");
        const desc = container.querySelector(".ib-cmodal__desc")!;
        expect(desc.textContent).toContain("10.128.1.6");
        expect(desc.querySelector('[data-event-variable="ph_plain"]')!.tagName).toBe("SPAN");
    });
});

function scopedModal(client: QueryClient, lifecycle: typeof runningLab) {
    return <QueryClientProvider client={client}><ChallengeModal challenge={{...challenge, Infrastructure: true, Lab: lifecycle, SolvedAt: "2026-10-08T12:00:00Z"}} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints onClose={() => {}} onAccepted={() => {}} /></QueryClientProvider>;
}
it("renders settled closure before pending runtime and retains results and ordinary organizer links", () => {
    runtimeAPI.mockReturnValue(new Promise(() => {}));
    const {container} = render(scopedModal(new QueryClient(), completedLab));
    expect(screen.getByText("Усі завдання цього середовища виконано. Середовище закрито.")).toBeTruthy();
    expect(screen.getByText("Розвʼязано", {selector: "b"})).toBeTruthy();
    expect(container.querySelector('[data-empty-state]')).toBeTruthy();
    expect(runtimeAPI).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", {name: /VPN/})).toBeNull();
    expect(screen.queryByRole("button", {name: "Відкрити"})).toBeNull();
    expect(container.querySelector(".event-loading-logo")).toBeNull();
    expect(screen.getByRole("link", {name: "Довідка"}).getAttribute("href")).toBe("https://organizer.test/help");
    expect(container.querySelector(".ib-cmodal__desc")?.textContent).toContain("Відкрийте — або —");
});
it("never relabels revision 1 access as newer ready revision 3 and reveals actual revision 3 without remounting", async () => {
    const old = {...runningLab, Revision: "1"}; const fresh = {...runningLab, Revision: "3"};
    const access = [{Device: "web", Port: 80, Protocol: "http", URL: "https://old.test"}];
    runtimeAPI.mockResolvedValue({...runtimeFixture, Lab: old, Access: access});
    const client = new QueryClient(); const {container} = render(scopedModal(client, fresh));
    await waitFor(() => expect(client.getQueryData<{Lab: typeof old}>(["event-challenge-lab", "participant", "e", challenge.EventChallengeID])?.Lab?.Revision).toBe("1"));
    expect(container.querySelector(".ib-copy")).toBeNull();
    expect(container.querySelector(".ib-cmodal__desc a[data-event-variable]")).toBeNull();
    const dialog = container.querySelector("dialog");
    await act(async () => {client.setQueryData(["event-challenge-lab", "participant", "e", challenge.EventChallengeID], {...runtimeFixture, Lab: fresh, Access: [{...access[0], URL: "https://fresh.test"}]});});
    await screen.findByRole("link", {name: "https://10.128.1.5:8443/panel"});
    expect(container.querySelector(".ib-copy")?.textContent).toContain("https://fresh.test");
    expect(container.querySelector("dialog")).toBe(dialog);
});
it("an individually solved question keeps matching running environment access", async () => {
    runtimeAPI.mockResolvedValue({...runtimeFixture, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://fresh.test"}]});
    const {container} = render(scopedModal(new QueryClient(), runningLab));
    await screen.findByRole("link", {name: "https://10.128.1.5:8443/panel"});
    expect(container.querySelector(".ib-copy")).toBeTruthy(); expect(screen.getByText("Розвʼязано", {selector: "b"})).toBeTruthy();
});

it.each([true, false])("canonical task B never exposes cached raw A access (closed=%s)", async closed => {
    const canonical = {...runningLab, ID: "00000000-0000-4000-8000-000000000101", Revision: "1", LogicalClosed: closed,
        CloseReason: closed ? "solved" as const : null, RuntimeState: closed ? "closed" as const : "ready" as const};
    const client = new QueryClient(); client.setQueryData(["event-challenge-lab", "participant", "e", challenge.EventChallengeID], {...runtimeFixture, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://old.test"}]});
    runtimeAPI.mockReturnValue(new Promise(() => {}));
    const {container} = render(scopedModal(client, canonical));
    expect(container.querySelector(".ib-copy")).toBeNull(); expect(container.querySelector(".ib-cmodal__desc a[data-event-variable]")).toBeNull();
    expect(screen.getByText("Розвʼязано", {selector: "b"})).toBeTruthy();
    if (closed) {expect(screen.getByText("Усі завдання цього середовища виконано. Середовище закрито.")).toBeTruthy(); expect(screen.queryByRole("button", {name: /VPN/})).toBeNull();}
    else {
        const dialog = container.querySelector("dialog");
        await act(async () => {client.setQueryData(["event-challenge-lab", "participant", "e", challenge.EventChallengeID], {...runtimeFixture, Lab: canonical, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://current.test"}]});});
        await screen.findByRole("link", {name: "https://10.128.1.5:8443/panel"});
        expect(container.querySelector(".ib-copy")?.textContent).toContain("https://current.test"); expect(container.querySelector("dialog")).toBe(dialog);
    }
});
it.each([false, true])("failed refresh with cached runtime forwards error only when access is unusable (matching=%s)", async matching => {
    const current = {...runningLab, Revision: "3"}; const raw = {...runningLab, Revision: matching ? "3" : "1"};
    const key = ["event-challenge-lab", "participant", "e", challenge.EventChallengeID]; const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    client.setQueryData(key, {...runtimeFixture, Lab: raw, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://cached.test"}]});
    runtimeAPI.mockRejectedValue(new Error("offline"));
    const {container} = render(scopedModal(client, current));
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe("error"));
    if (matching) {expect(container.querySelector(".ib-copy")?.textContent).toContain("https://cached.test"); expect(container.querySelector("[data-load-error]")).toBeNull();}
    else {
        const retry = await screen.findByRole("button", {name: "Спробувати ще раз"});
        expect(container.querySelector("[data-load-error]")).toBeTruthy(); expect(container.querySelector(".event-loading-logo")).toBeNull(); expect(container.querySelector(".ib-copy")).toBeNull();
        const dialog = container.querySelector("dialog");
        runtimeAPI.mockResolvedValue({...runtimeFixture, Lab: current, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://refreshed.test"}]});
        fireEvent.click(retry);
        await waitFor(() => expect(container.querySelector(".ib-copy")?.textContent).toContain("https://refreshed.test"));
        expect(container.querySelector("[data-load-error]")).toBeNull(); expect(container.querySelector("dialog")).toBe(dialog);
    }
});

it("synchronous board ownership B renders closed before old A props update and does not poll access", () => {
    const canonical = {...completedLab, ID: "00000000-0000-4000-8000-000000000101", Revision: "1"};
    const client = new QueryClient();
    client.setQueryData(["event-own-challenges", "e"], ownBoardSchema.parse({ServerNow: "2026-10-08T12:00:00Z", Challenges: [{...challenge, Lab: canonical}]}));
    client.setQueryData(["event-challenge-lab", "participant", "e", challenge.EventChallengeID], {...runtimeFixture, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://old.test"}]});
    runtimeAPI.mockReturnValue(new Promise(() => {}));
    const {container} = render(scopedModal(client, runningLab));
    expect(screen.getByText("Усі завдання цього середовища виконано. Середовище закрито.")).toBeTruthy();
    expect(container.querySelector(".ib-copy")).toBeNull(); expect(runtimeAPI).not.toHaveBeenCalled();
});
