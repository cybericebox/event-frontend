// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {fixtureChallenge} from "./fixtures/challengeFixture";

vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: true, openVpn: () => {}})}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/api/participantChallenges", async importOriginal => ({
    ...await importOriginal<typeof import("@/api/participantChallenges")>(),
    getOwnChallengeLab: () => Promise.resolve({Phase: "Ready", Ready: true, VPNCIDR: "10.128.1.0/24", InternetCIDR: "", Access: []}),
}));

const {ChallengeModal} = await import("./ChallengeModal");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);

const text = (value: string) => ({type: "text", text: value, format: 0});
const variable = (name: string) => ({type: "variable", varName: name});
const challenge = {
    ...fixtureChallenge,
    Snapshot: {
        ...fixtureChallenge.Snapshot,
        description: {root: {type: "root", children: [{type: "paragraph", children: [text("Відкрийте "), variable("ph_link"), text(" або "), variable("ph_plain")]}]}},
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
