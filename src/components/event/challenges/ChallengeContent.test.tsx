// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, render} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {ChallengeTile} from "./ChallengeTile";
import {fixtureChallenge, fixtureTiles, LONG_CATEGORY, LONG_CODE_LINE, LONG_TITLE, LONG_URL, LONG_WORD} from "./fixtures/challengeFixture";

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
        expect(meta.querySelector(".event-vpn-badge")).toBeTruthy();
        expect(container.querySelector(".ib-cmodal__title")!.textContent).toBe(LONG_TITLE);
        expect(meta.querySelector(".ib-cmodal__cat span")!.textContent).toBe(LONG_CATEGORY);
        const modal = css("challenge-modal.css");
        expect(modal).toMatch(/\.ib-cmodal__meta\{[^}]*flex-wrap:wrap/);
        expect(modal).toMatch(/\.ib-cmodal__cat>span\{[^}]*text-overflow:ellipsis/);
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
        expect(tile).toMatch(/\.ib-tiles\{[^}]*minmax\(min\(152px,100%\),1fr\)/);
    });
    it("category headers truncate with a tooltip", () => {
        const board = css("challenge-board.css");
        expect(board).toMatch(/\.ib-board__cat h3\{[^}]*text-overflow:ellipsis/);
        expect(board).toMatch(/\.ib-board__chip-name\{[^}]*text-overflow:ellipsis/);
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
