// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {ChallengeTile} from "./ChallengeTile";
import {runtimeFixture} from "@/test/labLifecycle";
import {fixtureChallenge, fixtureTiles, LONG_CODE_LINE, LONG_TITLE, LONG_URL, LONG_WORD} from "./fixtures/challengeFixture";

vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: true, openVpn: () => {}})}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), getOwnChallengeLab: () => new Promise(() => {})}));

const {ChallengeModal} = await import("./ChallengeModal");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);

function renderModal(moderators = false) {
    const client = new QueryClient();
    client.setQueryData(["event-challenge-lab", moderators ? "moderators" : "participant", "e", fixtureChallenge.EventChallengeID], runtimeFixture);
    return render(<QueryClientProvider client={client}>
        <ChallengeModal challenge={fixtureChallenge} eventID="e" mode={moderators ? "moderators" : "participant"} teamMode finished={false} showDifficulty showHints hintChargeMode="reward" onClose={() => {}} onAccepted={() => {}} />
    </QueryClientProvider>);
}
const css = (name: string) => readFileSync(resolve(process.cwd(), "src/styles", name), "utf8");

describe("challenge modal content", () => {
    it("renders every node type of the description", () => {
        const {container} = renderModal();
        const desc = container.querySelector(".ib-cmodal__desc")!;
        for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) expect(desc.querySelector(`.event-lexical__${tag}`), tag).toBeTruthy();
        for (const tag of ["strong", "em", "u", "s", "code.event-lexical__inline-code", "blockquote", "pre code", "ul ul ul", "ol ol"]) expect(desc.querySelector(tag), tag).toBeTruthy();
        expect(desc.querySelectorAll("li").length).toBeGreaterThanOrEqual(11);
        expect(desc.textContent).not.toMatch(/"type"|"root"|\{"|\*\*|##/);
        expect(desc.textContent).toContain("Після порожнього абзацу.");
        expect(desc.querySelectorAll("p.event-lexical__paragraph").length).toBeGreaterThanOrEqual(5);
        expect(desc.querySelector("p:empty, p > br:only-child")).toBeTruthy();
    });

    it("keeps code whitespace, tabs and long lines", () => {
        const {container} = renderModal();
        const pre = container.querySelector(".ib-cmodal__desc pre")!;
        expect(pre.textContent).toContain("\n\t  return");
        expect(pre.textContent).toContain(LONG_CODE_LINE);
        expect(container.querySelector(".ib-cmodal__desc")!.querySelectorAll("pre")).toHaveLength(2);
        const view = css("rich-text-view.css");
        expect(view).toMatch(/event-lexical__code\{[^}]*white-space:pre;/);
        expect(view).toMatch(/event-lexical__code\{[^}]*overflow-x:auto/);
    });

    it("links are safe", () => {
        const {container} = renderModal();
        const links = [...container.querySelector(".ib-cmodal__desc")!.querySelectorAll<HTMLAnchorElement>("a")];
        const external = links.filter(a => a.href.startsWith("https://"));
        expect(external.length).toBe(2);
        for (const a of external) { expect(a.target).toBe("_blank"); expect(a.rel).toBe("noopener noreferrer"); }
        const internal = links.find(a => a.getAttribute("href") === "/rules")!;
        expect(internal.getAttribute("target")).toBeNull();
        expect(links.some(a => a.getAttribute("href")?.startsWith("javascript"))).toBe(false);
        expect(container.querySelector(".ib-cmodal__desc")!.textContent).toContain("небезпечне");
        expect(LONG_URL.length).toBeGreaterThan(200);
    });

    it("renders hints of every level formatted (and old plain text)", () => {
        const {container} = renderModal(true);
        const items = container.querySelectorAll(".event-cmodal__hints > li");
        expect(items).toHaveLength(4);
        for (const li of [...items].slice(0, 3)) {
            expect(li.querySelector("strong")).toBeTruthy();
            expect(li.querySelector("code.event-lexical__inline-code")).toBeTruthy();
            expect(li.querySelector("ul ol")).toBeTruthy();
            expect(li.querySelector("blockquote")).toBeTruthy();
            expect(li.querySelector("pre")!.textContent).toBe(LONG_CODE_LINE);
            expect(li.textContent).not.toContain('"root"');
        }
        expect(items[3].textContent).toContain("Старий текстовий");
        expect(container.querySelector(".event-cmodal__hint-text")).toBeTruthy();
    });

    it("shows the badges without breaking the header", () => {
        const {container} = renderModal();
        const meta = container.querySelector(".ib-cmodal__meta")!;
        expect(meta.querySelectorAll(".ib-tag").length).toBeGreaterThanOrEqual(4);
        expect(meta.querySelector(".event-cmodal__lab-tag")).toBeTruthy();
        expect(container.querySelector(".ib-cmodal__title")!.textContent).toBe(LONG_TITLE);
        expect(meta.querySelector(".ib-cmodal__cat")).toBeNull();
        const modal = css("challenge-modal.css");
        expect(modal).toMatch(/\.ib-cmodal__meta\{[^}]*flex-wrap:nowrap/);
        expect(modal).toMatch(/\.ib-cmodal__title\{[^}]*overflow-wrap:anywhere/);
        expect(css("tag.css")).toMatch(/\.ib-tag\{[^}]*max-width:100%/);
    });
});

describe("challenge tiles", () => {
    it("wraps long names and keeps the full name accessible", () => {
        const {container} = render(<div className="ib-tiles">{fixtureTiles.map(challenge => <ChallengeTile key={challenge.EventChallengeID} challenge={challenge} onOpen={() => {}} />)}</div>);
        expect(container.querySelectorAll(".ib-tile")).toHaveLength(24);
        expect(container.querySelector(`[aria-label^="${LONG_WORD}"]`)).toBeTruthy();
        expect(container.querySelectorAll(".ib-tile.is-locked").length).toBeGreaterThan(0);
        const tile = css("challenge-tile.css");
        expect(tile).toMatch(/\.ib-tile__name\{[^}]*-webkit-line-clamp:2[^}]*overflow-wrap:anywhere/);
        expect(tile).toContain("repeat(auto-fill,208px)");
    });
    it("a state under the page header fills the page and centers, not just the top-left corner", () => {
        const page = css("event-participant.css");
        expect(page).toMatch(/\.event-page-content>\.event-challenges\{[^}]*flex:1 0 auto[^}]*width:100%/);
        expect(page).toMatch(/\.event-challenges>\.event-block-state\{[^}]*align-self:stretch[^}]*width:100%/);
    });
    it("category headers truncate with a tooltip", () => {
        const board = css("challenge-board.css");
        expect(board).toMatch(/\.ib-board__cat h3\{[^}]*text-overflow:ellipsis/);
    });
});

describe("rich text view css", () => {
    it("has no accent border on quotes", () => {
        for (const file of ["rich-text-view.css", "event-page-builder.css", "event-manage.css"]) {
            const quote = css(file).split("\n").filter(line => line.includes(".event-lexical__quote{"));
            for (const line of quote) expect(line).not.toMatch(/border-left|box-shadow/);
        }
    });
});

it("keeps task card sizing consistent and layers dropdown portals above sticky cards", () => {
    expect(css("challenge-tile.css")).toContain("repeat(auto-fill,208px)");
    expect(css("event-participant.css")).toMatch(/\.event-board__groups\{z-index:80/);
    expect(css("select.css")).toMatch(/\.event-select__menu\{z-index:80/);
});

it("uses the selected two-column card with numeric points and optional difficulty metadata", () => {
    const {container,rerender}=render(<ChallengeTile challenge={{...fixtureChallenge,SolvedAt:null,ContentUpdatedAt:null,Infrastructure:true}} showDifficulty={false} onOpen={()=>{}}/>);
    let tile=container.querySelector(".ib-tile")!;
    expect(tile.querySelector(".ib-tile__pts")?.textContent).toBe("1250");
    expect(tile.querySelector(".lucide-network")).toBeTruthy();expect(tile.querySelector(".ib-tile__difficulty")).toBeNull();
    expect(tile.getAttribute("aria-label")).toContain("балів");
    rerender(<ChallengeTile challenge={{...fixtureChallenge,SolvedAt:null,ContentUpdatedAt:null,Infrastructure:false}} showDifficulty={false} onOpen={()=>{}}/>);
    tile=container.querySelector(".ib-tile")!;expect(tile.className).toContain("ib-tile--title-only");
    expect(tile.querySelector(".ib-tile__foot")).toBeNull();
    rerender(<ChallengeTile challenge={{...fixtureChallenge,SolvedAt:null,ContentUpdatedAt:null}} showDifficulty onOpen={()=>{}}/>);
    expect(container.querySelector(".ib-tile__difficulty")?.textContent).toBe("Складне");
});

it("centers a card when an unavailable difficulty produces no visible metadata", () => {
    const task={...fixtureChallenge,SolvedAt:null,ContentUpdatedAt:null,Infrastructure:false,Snapshot:{...fixtureChallenge.Snapshot,difficulty:undefined}} as unknown as typeof fixtureChallenge;
    const {container}=render(<ChallengeTile challenge={task} showDifficulty onOpen={()=>{}}/>);
    const tile=container.querySelector(".ib-tile")!;
    expect(tile.className).toContain("ib-tile--title-only");
    expect(tile.querySelector(".ib-tile__foot")).toBeNull();
    expect(css("challenge-tile.css")).toMatch(/\.ib-tile__main\{[^}]*align-items:center/);
});

it.each([false,true])("matches all approved card metadata/state combinations (difficulty=%s)", showDifficulty => {
    for (const infrastructure of [false,true]) for (const state of ["available","solved","closed"] as const) {
        const challenge={...fixtureChallenge,Infrastructure:infrastructure,SolvedAt:state==="solved"?"2026-10-01T10:00:00Z":null,Closed:state==="closed",Locked:false,Practice:false,ContentUpdatedAt:"2026-10-01T11:00:00Z",Snapshot:{...fixtureChallenge.Snapshot,name:LONG_WORD}};
        const view=render(<ChallengeTile challenge={challenge} showDifficulty={showDifficulty} onOpen={()=>{}}/>);
        const tile=view.container.querySelector(".ib-tile")!;
        expect(tile.querySelector(".ib-tile__name")?.textContent).toBe(LONG_WORD);
        expect(tile.querySelector(".ib-tile__score .lucide-network")!==null).toBe(infrastructure);
        expect(tile.querySelector(".ib-tile__main .ib-tile__difficulty")!==null).toBe(showDifficulty);
        expect(tile.querySelector(".ib-tile__states,.ib-tile__solved,.ib-tile__upd,.ib-tile__closed,.ib-tile__practice,.ib-tile__lock")).toBeNull();
        expect(tile.hasAttribute("title")).toBe(false);
        expect(tile.classList.contains("is-solved")).toBe(state==="solved");
        expect(tile.classList.contains("is-closed")).toBe(state==="closed");
        expect(view.container.querySelector(".ib-tile-tip>.ib-tip__bubble")?.textContent).toBe(LONG_WORD);
        view.unmount();
    }
});
it("centers the event loader over the entire card while keeping locked semantics", () => {
    const {container}=render(<ChallengeTile challenge={{...fixtureChallenge,SolvedAt:null,Locked:true,LockedBusy:true}} showDifficulty onOpen={()=>{}}/>);
    const tile=container.querySelector(".ib-tile")!;
    expect(tile.getAttribute("aria-busy")).toBe("true"); expect(tile.getAttribute("aria-disabled")).toBe("true");
    expect(tile.classList.contains("is-closed")).toBe(false);
    expect(tile.querySelector(".ib-tile__loading img")).toBeTruthy();
    expect(css("challenge-tile.css")).toMatch(/\.ib-tile__loading\{[^}]*position:absolute[^}]*inset:0[^}]*place-items:center/);
});

it("keeps the full long-word title tooltip within the phone viewport", () => {
    const previous = window.innerWidth; window.innerWidth = 390;
    const rect = vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("ib-tip__bubble")
            ? {left:0,right:280,top:0,bottom:60,width:280,height:60,x:0,y:0,toJSON:()=>({})}
            : {left:17,right:192,top:100,bottom:188,width:175,height:88,x:17,y:100,toJSON:()=>({})};
    });
    try {
        const {container}=render(<ChallengeTile challenge={{...fixtureChallenge,Infrastructure:false,Snapshot:{...fixtureChallenge.Snapshot,name:LONG_WORD}}} onOpen={()=>{}}/>);
        fireEvent.focus(container.querySelector("button")!);
        const bubble=container.querySelector<HTMLElement>(".ib-tile-tip>.ib-tip__bubble")!;
        expect(bubble.getAttribute("popover")).toBe("manual");
        expect(bubble.style.left).toBe("12px");
        expect(bubble.textContent).toBe(LONG_WORD);
        expect(css("challenge-tile.css")).toMatch(/\.ib-tile-tip>\.ib-tip__bubble\{[^}]*max-width:min\(280px,calc\(100vw - 24px\)\)[^}]*overflow-wrap:anywhere/);
    } finally {rect.mockRestore(); window.innerWidth=previous;}
});
