// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {runtimeFixture} from "@/test/labLifecycle";
import {fixtureChallenge} from "./fixtures/challengeFixture";

const vpn = vi.hoisted(() => ({available: true, connected: false, openVpn: vi.fn()}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => vpn}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), getOwnChallengeLab: () => new Promise(() => {})}));
vi.mock("@/api/manageLabs", async importOriginal => ({
    ...await importOriginal<typeof import("@/api/manageLabs")>(),
    getModeratorChallengeLab: () => Promise.resolve({...runtimeFixture, Access: [
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
afterEach(() => {cleanup(); vpn.available=true; vpn.connected=false; vpn.openVpn.mockReset();});

function readyClient(mode: "participant" | "moderators" = "participant") {
    const client = new QueryClient();
    client.setQueryData(["event-challenge-lab", mode, "e", fixtureChallenge.EventChallengeID], runtimeFixture);
    return client;
}
function renderModal(mode: "participant" | "moderators") {
    return render(<QueryClientProvider client={readyClient(mode)}>
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

    it("participants see the lab tag and VPN prompt without an automatic service list", () => {
        renderModal("participant");
        expect(screen.queryByRole("region", {name: "Лише для модераторів"})).toBeNull();
        expect(screen.queryByRole("heading", {name: /Сервіс|Підключення/})).toBeNull();
        expect(screen.getByLabelText("Лабораторія")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Відкрити VPN"})).toBeTruthy();
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


it("keeps attachment downloads in a filename button without an exposed route", () => {
    renderModal("participant");
    expect(screen.getByRole("button", {name: new RegExp(fixtureChallenge.Files![0].Name)})).toBeTruthy();
    expect(document.querySelector('a[download]')).toBeNull();
});

it.each([{lab:false,available:true,connected:false},{lab:true,available:false,connected:false},{lab:true,available:true,connected:true},{lab:true,available:true,connected:false}])("shows and opens VPN only for a lab with available disconnected VPN %o", ({lab,available,connected}) => {
    vpn.available=available;vpn.connected=connected;
    render(<QueryClientProvider client={readyClient()}><ChallengeModal challenge={{...fixtureChallenge,Infrastructure:lab}} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints={false} onClose={()=>{}} onAccepted={()=>{}}/></QueryClientProvider>);
    const prompt=screen.queryByRole("button",{name:"Відкрити VPN"});
    expect(!!prompt).toBe(lab&&available&&!connected);
    expect(!!screen.queryByLabelText("Лабораторія")).toBe(lab);
    if(prompt){fireEvent.click(prompt); expect(vpn.openVpn).toHaveBeenCalledOnce();}
});
it("solves tab keeps the task flag form out of the visible panel", () => {
    const client = new QueryClient(); client.setQueryData(["event-challenge-lab", "participant", "e", fixtureChallenge.EventChallengeID], runtimeFixture);
    render(<QueryClientProvider client={client}><ChallengeModal challenge={{...fixtureChallenge,SolvedAt:null}} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints={false} onClose={()=>{}} onAccepted={()=>{}}/></QueryClientProvider>);
    expect(screen.getByRole("textbox",{name:"Прапор"})).toBeTruthy();
    fireEvent.click(screen.getByRole("tab",{name:"Розвʼязання (7)"}));
    expect(screen.queryByRole("textbox",{name:"Прапор"})).toBeNull();
});

it("keeps the flag footer outside the bounded scrolling task body", () => {
    const client = new QueryClient(); client.setQueryData(["event-challenge-lab", "participant", "e", fixtureChallenge.EventChallengeID], runtimeFixture);
    render(<QueryClientProvider client={client}><ChallengeModal challenge={{...fixtureChallenge,SolvedAt:null}} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints onClose={()=>{}} onAccepted={()=>{}}/></QueryClientProvider>);
    const form=document.querySelector(".ib-cmodal__flag")!;
    expect(form.closest(".ib-cmodal__body")).toBeNull();
    expect(form.parentElement?.className).toBe("ib-cmodal__task-pane");
    expect(form.previousElementSibling?.className).toBe("ib-cmodal__body");
    const css=readFileSync(resolve(process.cwd(),"src/styles/challenge-modal.css"),"utf8");
    expect(css).toMatch(/max-height:calc\(100dvh - 112px\)/);
    expect(css).toMatch(/\.ib-cmodal__body\{[^}]*overflow:auto/);
    expect(css).toMatch(/\.ib-cmodal__flag \.ib-cmodal__row\{flex-direction:column/);
});
