// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fixtureChallenge} from "./fixtures/challengeFixture";

vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: true, openVpn: () => {}})}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), getOwnChallengeLab: () => new Promise(() => {})}));
vi.mock("@/api/manageLabs", async importOriginal => ({
    ...await importOriginal<typeof import("@/api/manageLabs")>(),
    getModeratorChallengeLab: () => Promise.resolve({Phase: "Ready", Ready: true, VPNCIDR: "10.128.1.0/24", InternetCIDR: "", Access: [
        {Device: "web", Port: 443, Protocol: "https", URL: "https://lab.example/panel"},
        {Device: "db", Port: 5432, Protocol: "tcp", URL: ""},
    ]}),
}));
vi.mock("./ChallengeSolvesTab", () => ({ChallengeSolvesTab: () => null}));

const {ChallengeModal} = await import("./ChallengeModal");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);

function renderModal(mode: "participant" | "moderators") {
    return render(<QueryClientProvider client={new QueryClient()}>
        <ChallengeModal challenge={{...fixtureChallenge, SolveCount: 7}} eventID="e" mode={mode} teamMode finished={false} showDifficulty showHints hintChargeMode="reward" onClose={() => {}} onAccepted={() => {}} />
    </QueryClientProvider>);
}

describe("challenge modal tabs", () => {
    it("shows the number of solves in the tab", () => {
        renderModal("participant");
        expect(screen.getByRole("tab", {name: "Розвʼязання (7)"})).toBeTruthy();
    });

    it("a mouse click turns the focus ring off for the tabs, a key brings it back", () => {
        renderModal("participant");
        const list = screen.getByRole("tablist");
        expect(list.hasAttribute("data-pointer")).toBe(false);
        fireEvent.pointerDown(screen.getByRole("tab", {name: "Розвʼязання (7)"}));
        expect(list.hasAttribute("data-pointer")).toBe(true);
        fireEvent.keyDown(list, {key: "ArrowLeft"});
        expect(list.hasAttribute("data-pointer")).toBe(false);
        expect(readFileSync(resolve(process.cwd(), "src/styles/challenge-modal.css"), "utf8")).toMatch(/\.ib-cmodal__tabs\[data-pointer\]>\[role="tab"\]:focus\{outline:none\}/);
    });
});

describe("moderators block", () => {
    it("holds the moderator-only info in one block with the access method and no links", async () => {
        const {container} = renderModal("moderators");
        const block = await screen.findByRole("region", {name: "Лише для модераторів"});
        expect(await within(block).findByText("Доступ: VPN, вебпосилання")).toBeTruthy();
        expect(within(block).getByText(/Відповіді надсилаються від імені прихованої команди модераторів/)).toBeTruthy();
        expect(block.querySelector("a, button")).toBeNull();
        // no separate list of services and links
        expect(container.querySelector(".event-cmodal__hosts, .ib-copy")).toBeNull();
        expect(screen.queryByRole("heading", {name: "Сервіс"})).toBeNull();
    });

    it("participants do not see the block and keep the service list", () => {
        renderModal("participant");
        expect(screen.queryByRole("region", {name: "Лише для модераторів"})).toBeNull();
        expect(screen.getByRole("heading", {name: /Сервіс|Підключення/})).toBeTruthy();
    });
});

describe("challenge modal keyboard", () => {
    it("opens with the focus on the title, not in the flag input", () => {
        renderModal("participant");
        expect(document.activeElement).toBe(screen.getByRole("heading", {name: fixtureChallenge.Snapshot.name}));
    });

    it("moves the focus with the arrow keys between the tabs", () => {
        renderModal("participant");
        const task = screen.getByRole("tab", {name: "Завдання"});
        fireEvent.keyDown(task, {key: "ArrowRight"});
        const solves = screen.getByRole("tab", {name: "Розвʼязання (7)"});
        expect(solves.getAttribute("aria-selected")).toBe("true");
        expect(document.activeElement).toBe(solves);
        fireEvent.keyDown(solves, {key: "Home"});
        expect(document.activeElement).toBe(task);
    });
});

