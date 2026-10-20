// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {EventRichTextView} from "./EventRichTextView";
import {copyBlockUrl} from "./CopyBlock";
import fixture from "./copyBlockFixture.json";

afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();});
it("renders the shared children-based fixture and copies resolved plain text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText}});
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<EventRichTextView value={fixture} variables={{host: "lab.example.test"}} />);
    expect(document.querySelector("[data-copy-block] code")?.textContent).toBe("https://lab.example.test/panel?x=1&y=2");
    await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Копіювати"}));});
    expect(writeText).toHaveBeenCalledWith("https://lab.example.test/panel?x=1&y=2");
    expect(screen.getByRole("button", {name: "Скопійовано"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: "Відкрити в новій вкладці"}));
    expect(open).toHaveBeenCalledWith("https://lab.example.test/panel?x=1&y=2", "_blank", "noopener,noreferrer");
});
it.each(["javascript:alert(1)", "data:text/html,x", "https://user:pass@host.test", "https://host.test\n.evil", "//host.test", "https://host.test\\evil"])("rejects unsafe open value %s", value => {
    expect(copyBlockUrl(value)).toBeNull();
});
it("keeps unresolved nested variables as plain text and removes open after lifecycle withdrawal", () => {
    const view = render(<EventRichTextView value={fixture} variables={{host: "lab.test"}} />);
    expect(screen.getByRole("button", {name: "Відкрити в новій вкладці"})).toBeTruthy();
    view.rerender(<EventRichTextView value={fixture} variables={{host: "—"}} />);
    expect(screen.queryByRole("button", {name: "Відкрити в новій вкладці"})).toBeNull();
    expect(document.querySelector("code")?.textContent).toBe("https://—/panel?x=1&y=2");
});
it("announces a clipboard failure and clears a pending completion after unmount", async () => {
    Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: vi.fn().mockRejectedValue(new Error("denied"))}});
    const view = render(<EventRichTextView value={fixture} variables={{host: "lab.test"}} />);
    await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Копіювати"}));});
    expect(screen.getByRole("status").textContent).toBe("Не вдалося скопіювати");
    let resolve!: () => void;
    navigator.clipboard.writeText = vi.fn(() => new Promise<void>(reply => {resolve = reply;}));
    fireEvent.click(screen.getByRole("button", {name: "Копіювати"}));
    view.unmount();
    await act(async () => resolve());
});

it("preserves the actual composed proxy destination and does not hijack a docs URL containing a device", () => {
    const proxy=vi.fn(); const open=vi.spyOn(window,"open").mockReturnValue(null);
    const variable={type:"variable",varName:"device"};
    const doc=(children:unknown[])=>({root:{type:"root",children:[{type:"copy-block",children}]}});
    const view=render(<EventRichTextView value={doc([variable,{type:"text",text:"/panel?x=1"}])} variables={{device:"https://lab.test"}} openVariables={{device:proxy}}/>);
    fireEvent.click(screen.getByRole("button",{name:"Відкрити в новій вкладці"}));
    expect(proxy).toHaveBeenCalledWith("https://lab.test/panel?x=1");
    view.rerender(<EventRichTextView value={doc([{type:"text",text:"https://docs.test/?device="},variable])} variables={{device:"https://lab.test"}} openVariables={{device:proxy}}/>);
    fireEvent.click(screen.getByRole("button",{name:"Відкрити в новій вкладці"}));
    expect(proxy).toHaveBeenCalledOnce();expect(open).toHaveBeenCalledWith("https://docs.test/?device=https://lab.test","_blank","noopener,noreferrer");
});
