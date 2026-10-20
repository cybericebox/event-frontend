// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import type {OwnChallenge} from "@/api/participantChallenges";

const unlock = vi.fn();
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), unlockChallengeHint: (...args: unknown[]) => unlock(...args)}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}})}));

const {HintsBlock} = await import("./ChallengeModal");

// jsdom has no top-layer dialog.
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => { cleanup(); unlock.mockReset(); });

const challenge = {
    EventChallengeID: "c1", HintCostTotal: 0,
    Hints: [
        {ID: "h1", Level: "nudge", Cost: 0, Unlocked: true, Content: "Дивіться у заголовки", UnlockedAt: "2026-09-29T09:12:00Z", UnlockedByName: "Андрій"},
        {ID: "h2", Level: "steps", Cost: 50, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""},
        {ID: "h3", Level: "direction", Cost: 0, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""},
    ],
} as unknown as OwnChallenge;

describe("HintsBlock", () => {
    it("shows unlocked texts with who opened them", () => {
        render(<HintsBlock challenge={challenge} eventID="e" moderators={false} chargeMode="reward" onUnlocked={() => {}} />);
        expect(screen.getByText("Дивіться у заголовки")).toBeTruthy();
        expect(screen.getByText(/Відкрито: Андрій/)).toBeTruthy();
        expect(screen.getByText("· −50 балів")).toBeTruthy();
        expect(screen.getByText(/^Підказка 2/)).toBeTruthy();
        expect(screen.queryByText(/Покроково/)).toBeNull();
        expect(screen.getAllByRole("button", {name: /^Відкрити підказку/})).toHaveLength(2);
    });

    it("confirms a paid hint with the mode effect before unlocking", async () => {
        unlock.mockResolvedValue({});
        const onUnlocked = vi.fn();
        render(<HintsBlock challenge={challenge} eventID="e" moderators={false} teamMode chargeMode="balance" onUnlocked={onUnlocked} />);
        fireEvent.click(screen.getAllByRole("button", {name: /^Відкрити підказку/})[0]);
        expect(unlock).not.toHaveBeenCalled();
        expect(screen.getByText("Відкриття одразу спише 50 балів з рахунку команди.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Відкрити"}));
        await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
        expect(unlock).toHaveBeenCalledWith("e", "c1", "h2");
    });

    it("opens a free hint at once", async () => {
        unlock.mockResolvedValue({});
        const onUnlocked = vi.fn();
        render(<HintsBlock challenge={challenge} eventID="e" moderators={false} chargeMode="reward" onUnlocked={onUnlocked} />);
        fireEvent.click(screen.getAllByRole("button", {name: /^Відкрити підказку/})[1]);
        await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
        expect(unlock).toHaveBeenCalledWith("e", "c1", "h3");
    });

    it("shows the error when the unlock fails", async () => {
        const {ParticipantChallengeError} = await import("@/api/participantChallenges");
        unlock.mockRejectedValue(new ParticipantChallengeError(409, 1933));
        render(<HintsBlock challenge={challenge} eventID="e" moderators={false} chargeMode="reward" onUnlocked={() => {}} />);
        fireEvent.click(screen.getAllByRole("button", {name: /^Відкрити підказку/})[1]);
        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(screen.getByText("Підказки для цього завдання вимкнено")).toBeTruthy();
    });

    it("renders a rich-text hint formatted", () => {
        const content = JSON.stringify({root: {type: "root", children: [{type: "paragraph", children: [{type: "text", text: "curl -I", format: 16}]}]}});
        const rich = {...challenge, Hints: [{...challenge.Hints[0], Content: content}]} as OwnChallenge;
        const {container} = render(<HintsBlock challenge={rich} eventID="e" moderators={false} chargeMode="reward" onUnlocked={() => {}} />);
        expect(container.querySelector("code")?.textContent).toBe("curl -I");
        expect(screen.queryByText(content)).toBeNull();
    });

    it("never offers unlocking on the moderators board", () => {
        render(<HintsBlock challenge={challenge} eventID="e" moderators chargeMode="reward" onUnlocked={() => {}} />);
        expect(screen.queryByRole("button", {name: /^Відкрити підказку/})).toBeNull();
        expect(screen.getByText(/Підказка 2 · Покроково/)).toBeTruthy();
    });
});

it("collapses and expands purchased hints locally without unlocking or loading them again", () => {
    const revealed={...challenge,Hints:[{...challenge.Hints[1],Unlocked:true,Content:"Purchased hint text"}]} as OwnChallenge;
    render(<HintsBlock challenge={revealed} eventID="e" moderators={false} chargeMode="reward" onUnlocked={()=>{}}/>);
    const toggle=screen.getByRole("button",{name:/^Підказки/});
    const content=screen.getByText("Purchased hint text");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toContain("1 / 1");
    expect(toggle.getAttribute("aria-label")).toBe("Підказки: відкрито 1 з 1");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)?.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Purchased hint text")).toBe(content);
    expect(content.closest("[hidden]")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: /^Підказка 1/}));
    expect(content.closest("[hidden]")).toBeNull();
    expect(unlock).not.toHaveBeenCalled();
});

it("updates the header count when a hint is unlocked and retains it across collapse", () => {
    const props={eventID:"e",moderators:false,chargeMode:"reward" as const,onUnlocked:()=>{}};
    const view=render(<HintsBlock {...props} challenge={challenge}/>);
    expect(screen.getByRole("button",{name:"Підказки: відкрито 1 з 3"}).textContent).toContain("1 / 3");
    view.rerender(<HintsBlock {...props} challenge={{...challenge,Hints:challenge.Hints.map(hint=>hint.ID==="h2"?{...hint,Unlocked:true,Content:"Newly purchased"}:hint)}}/>);
    const toggle=screen.getByRole("button",{name:"Підказки: відкрито 2 з 3"});
    fireEvent.click(toggle); expect(toggle.textContent).toContain("2 / 3");
    fireEvent.click(toggle); expect(screen.getByText("Newly purchased")).toBeTruthy();
    expect(unlock).not.toHaveBeenCalled();
});

it("individually collapses unlocked hints and whole collapse leaves them closed on reopen", () => {
    render(<HintsBlock challenge={challenge} eventID="e" moderators={false} chargeMode="reward" onUnlocked={()=>{}}/>);
    const item=screen.getByRole("button",{name:/^Підказка 1/});
    const body=screen.getByText("Дивіться у заголовки");
    fireEvent.click(item); expect(item.getAttribute("aria-expanded")).toBe("false");
    expect(body.closest("[hidden]")).toBeTruthy();
    fireEvent.click(item); expect(body.closest("[hidden]")).toBeNull();
    const section=screen.getByRole("button",{name:/^Підказки:/}); fireEvent.click(section); fireEvent.click(section);
    expect(item.getAttribute("aria-expanded")).toBe("false"); expect(body.closest("[hidden]")).toBeTruthy();
    fireEvent.click(item); expect(body.closest("[hidden]")).toBeNull(); expect(unlock).not.toHaveBeenCalled();
});
it("newly opened hints expand with the same rich formatting, placeholders and copy blocks as task descriptions", async () => {
    const doc={root:{type:"root",children:[{type:"heading",tag:"h3",children:[{type:"text",text:"Заголовок"}]},{type:"paragraph",children:[{type:"text",text:"Виділення",format:1}]},{type:"code",children:[{type:"text",text:"curl -I"}]},{type:"list",listType:"bullet",children:[{type:"listitem",children:[{type:"text",text:"Пункт"}]}]},{type:"copy-block",version:1,children:[{type:"variable",varName:"host"}]}]}};
    const fresh={...challenge,Hints:[{...challenge.Hints[2],Unlocked:false}]};
    unlock.mockResolvedValue({...fresh.Hints[0],Unlocked:true,Content:JSON.stringify(doc)});
    const {container}=render(<HintsBlock challenge={fresh} eventID="e" moderators={false} chargeMode="reward" variables={{host:"https://lab.test"}} onUnlocked={()=>{}}/>);
    fireEvent.click(screen.getByRole("button",{name:/^Відкрити підказку/}));
    expect(await screen.findByRole("heading",{name:"Заголовок"})).toBeTruthy();
    expect(container.querySelector("strong")?.textContent).toBe("Виділення");
    expect(container.querySelector("pre code")?.textContent).toBe("curl -I");
    expect(container.querySelector("ul ul li")?.textContent).toBe("Пункт");
    expect(container.querySelector("[data-copy-block] code")?.textContent).toBe("https://lab.test");
    expect(screen.getByRole("button",{name:/^Підказка 1/}).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button",{name:"Підказки: відкрито 1 з 1"})).toBeTruthy();
    expect(unlock).toHaveBeenCalledOnce();
});

it.each([true,false])("hint confirmation uses actual participation mode (team=%s)",teamMode=>{
 render(<HintsBlock challenge={challenge} eventID="e" moderators={false} teamMode={teamMode} chargeMode="balance" onUnlocked={()=>{}}/>);
 fireEvent.click(screen.getAllByRole("button",{name:/^Відкрити підказку/})[0]);
 expect(!!screen.queryByText("Підказку побачить уся команда.")).toBe(teamMode);
 expect(screen.getByText(teamMode?"Відкриття одразу спише 50 балів з рахунку команди.":"Відкриття одразу спише 50 балів з вашого рахунку.")).toBeTruthy();
});
