// @vitest-environment jsdom
import {afterEach, beforeAll, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {GuestShell} from "./GuestShell";
import {useEventVpn} from "./vpn/EventVpn";

const preview = vi.hoisted(() => ({active: true, state: {status: 0, tasks: true, team: null}, config: {InfrastructureAllowed: false}}));
vi.mock("./ParticipantPreview", () => ({useParticipantPreview: () => preview, previewResultsAvailability: () => ({})}));
vi.mock("next/navigation", () => ({usePathname: () => "/challenges", useRouter: () => ({push: vi.fn()})}));
vi.mock("./EventNavigation", async original => {
    const actual = await original<typeof import("./EventNavigation")>();
    return {...actual, EventNavbar: (props: React.ComponentProps<typeof actual.EventNavbar>) => <nav><actual.EventHeaderActions {...props} /></nav>};
});
vi.mock("./InboxButton", () => ({InboxButton: () => null}));
vi.mock("@/api/clientAuth", async original => ({...await original<typeof import("@/api/clientAuth")>(), getCurrentUser: async () => null}));
vi.mock("@/api/participantPreview", async original => ({...await original<typeof import("@/api/participantPreview")>(), getPreviewLab: async () => ({Ready: true, VPNConnected: false})}));

afterEach(() => {cleanup(); preview.state.status = 0; preview.state.tasks = true;});
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {this.open = true;};
    HTMLDialogElement.prototype.close = function () {this.open = false;};
});
const event = {EventID: "event", Tag: "test", Name: "Test", Participation: 1, Theme: {}} as PublicEventInfo;
function TaskVpn() {
    const vpn = useEventVpn();
    return <button onClick={vpn.openVpn}>Task VPN</button>;
}
function mount() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
    client.setQueryData(["site-banners", event.EventID], []);
    client.setQueryData(["event-current-user"], null);
    client.setQueryData(["event-participant-preview-board", event.EventID], {Challenges: [{Infrastructure: true, PreviewDynamic: true, PreviewRunID: "run", PreviewSelectionID: "selection"}]});
    return render(<QueryClientProvider client={client}><GuestShell event={event} authenticated><TaskVpn /></GuestShell></QueryClientProvider>);
}
it.each([0, 2])("shares the header and task VPN for test tasks regardless of simulated registration (%s), team or event infrastructure", async status => {
    preview.state.status = status;
    mount();
    const header = await screen.findByRole("button", {name: /VPN:/});
    fireEvent.click(header);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(await screen.findByRole("button", {name: "Завантажити файл"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: "Закрити"}));
    fireEvent.click(screen.getByRole("button", {name: "Task VPN"}));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
});
it("does not offer preview VPN before test tasks or admission", () => {
    preview.state.tasks = false;
    mount();
    expect(screen.queryByRole("button", {name: /VPN:/})).toBeNull();
});
