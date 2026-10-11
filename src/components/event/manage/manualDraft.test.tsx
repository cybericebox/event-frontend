// @vitest-environment jsdom
import {useState} from "react";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ManualDraftProvider, useDraftDirty, useSessionDraftState, clearManualDrafts} from "./manualDraft";
/* eslint-disable @next/next/no-html-link-for-pages -- Tests native anchor interception. */
import {t} from "@/i18n/t";

HTMLDialogElement.prototype.showModal ??= function () {this.setAttribute("open", "");};
HTMLDialogElement.prototype.close ??= function () {this.removeAttribute("open");};

const navigation = vi.hoisted(() => ({pathname: "/manage/settings", push: vi.fn(), replace: vi.fn()}));
vi.mock("next/navigation", () => ({usePathname: () => navigation.pathname, useRouter: () => ({push: navigation.push, replace: navigation.replace})}));

function Form() {
    const [edited, setEdited] = useSessionDraftState<string | null>("name", null);
    useDraftDirty("name", edited !== null && edited !== "server");
    const [sent, setSent] = useState<string | null>(null);
    return <><input aria-label="name" value={edited ?? "server"} onChange={event => setEdited(event.target.value)} />
        <button onClick={() => setEdited(null)}>save</button>
        <button onClick={() => setSent(edited)}>start save</button>
        <button onClick={() => setEdited(current => current === sent ? null : current)}>finish save</button>
        <a href="/manage/schedule">schedule</a></>;
}
const view = (userID = "user-a", eventID = "event-a") => <ManualDraftProvider userID={userID} eventID={eventID}><Form /></ManualDraftProvider>;

beforeEach(() => {sessionStorage.clear(); navigation.pathname = "/manage/settings"; navigation.push.mockReset(); navigation.replace.mockReset(); window.history.replaceState({}, "", "/manage/settings");});
afterEach(cleanup);

describe("manual session drafts", () => {
    it("warns on document exit only while edits are unsaved and preserves the draft", () => {
        render(view());
        const clean = new Event("beforeunload", {cancelable: true});
        window.dispatchEvent(clean);
        expect(clean.defaultPrevented).toBe(false);
        fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}});
        const dirty = new Event("beforeunload", {cancelable: true});
        window.dispatchEvent(dirty);
        expect(dirty.defaultPrevented).toBe(true);
        expect(Object.values(sessionStorage).some(value => value.includes("local"))).toBe(true);
        fireEvent.click(screen.getByText("save"));
        const saved = new Event("beforeunload", {cancelable: true});
        window.dispatchEvent(saved);
        expect(saved.defaultPrevented).toBe(false);
    });

    it("does not show a second exit warning after navigation was confirmed", () => {
        let prevented = true;
        navigation.push.mockImplementation(() => {
            const exit = new Event("beforeunload", {cancelable: true});
            window.dispatchEvent(exit);
            prevented = exit.defaultPrevented;
        });
        render(view());
        fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}});
        fireEvent.click(screen.getByText("schedule"));
        fireEvent.click(screen.getByText(t("manage.unsaved.discard")));
        expect(navigation.push).toHaveBeenCalledOnce();
        expect(prevented).toBe(false);
        expect(Object.keys(sessionStorage)).toHaveLength(0);
    });

    it("restores edits after refresh and clears only after successful save", () => {
        const first = render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}}); first.unmount();
        const restored = render(view()); expect(screen.getByLabelText("name")).toHaveProperty("value", "local");
        fireEvent.click(screen.getByText("save")); restored.unmount(); render(view()); expect(screen.getByLabelText("name")).toHaveProperty("value", "server");
    });
    it("isolates users, events and routes", () => {
        const first = render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "private"}}); first.unmount();
        const other = render(view("user-b")); expect(screen.getByLabelText("name")).toHaveProperty("value", "server"); other.unmount();
        const event = render(view("user-a", "event-b")); expect(screen.getByLabelText("name")).toHaveProperty("value", "server"); event.unmount();
        navigation.pathname = "/manage/schedule"; render(view()); expect(screen.getByLabelText("name")).toHaveProperty("value", "server");
    });
    it("canceled navigation retains the page and its restored draft", () => {
        const first = render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}}); fireEvent.click(screen.getByText("schedule"));
        expect(navigation.push).not.toHaveBeenCalled(); expect(screen.getByText(t("manage.unsaved.title"))).toBeTruthy();
        fireEvent.click(screen.getByText(t("common.cancel"))); expect(screen.getByLabelText("name")).toHaveProperty("value", "local");
        first.unmount(); render(view()); expect(screen.getByLabelText("name")).toHaveProperty("value", "local");
    });
    it("confirmed navigation discards this page's draft", () => {
        const first = render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}}); fireEvent.click(screen.getByText("schedule"));
        fireEvent.click(screen.getByText(t("manage.unsaved.discard"))); expect(navigation.push).toHaveBeenCalledWith("/manage/schedule");
        first.unmount(); render(view()); expect(screen.getByLabelText("name")).toHaveProperty("value", "server");
    });
    it("a save finishing after another edit keeps the newer draft", () => {
        const first = render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "sent"}}); fireEvent.click(screen.getByText("start save"));
        fireEvent.change(screen.getByLabelText("name"), {target: {value: "newer"}}); fireEvent.click(screen.getByText("finish save")); first.unmount();
        render(view()); expect(screen.getByLabelText("name")).toHaveProperty("value", "newer");
    });
    it("stores synchronously even before effects or unload", () => {
        render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "immediate"}});
        expect(Object.values(sessionStorage).some(value => value.includes("immediate"))).toBe(true);
    });
    it("ignores hash changes and links opened in another tab", () => {
        render(<ManualDraftProvider userID="user-a" eventID="event-a"><Form /><a href="#sample">hash</a><a href="/manage/schedule" target="_blank">new tab</a></ManualDraftProvider>);
        fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}}); fireEvent.click(screen.getByText("hash")); fireEvent.click(screen.getByText("new tab"));
        expect(screen.queryByText(t("manage.unsaved.title"))).toBeNull();
    });
    it("restores a canceled history navigation without adding history entries", () => {
        const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
        const push = vi.spyOn(window.history, "pushState");
        const rawReplace = window.history.replaceState;
        render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}});
        rawReplace.call(window.history, {...window.history.state, cibDraftIndex: -1}, "", "/manage/schedule");
        act(() => window.dispatchEvent(new PopStateEvent("popstate", {state: window.history.state})));
        expect(go).toHaveBeenCalledWith(1); fireEvent.click(screen.getByText(t("common.cancel")));
        expect(push).not.toHaveBeenCalled(); expect(screen.getByLabelText("name")).toHaveProperty("value", "local");
        go.mockRestore(); push.mockRestore();
    });
    it("clears only this application's drafts on logout", () => {
        render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "private"}});
        sessionStorage.setItem("other-app", "keep"); clearManualDrafts();
        expect(Object.keys(sessionStorage)).toEqual(["other-app"]);
    });
    it("keeps edits in memory and guards navigation if session storage is blocked", () => {
        const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {throw new DOMException("blocked");});
        render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}}); fireEvent.click(screen.getByText("schedule"));
        expect(screen.getByText(t("manage.unsaved.title"))).toBeTruthy(); fireEvent.click(screen.getByText(t("common.cancel")));
        expect(screen.getByLabelText("name")).toHaveProperty("value", "local"); write.mockRestore();
    });
    it("preserves underscore-suffixed page drafts when discarding another page", () => {
        navigation.pathname = "/manage/page_"; const first = render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "retain"}}); first.unmount();
        navigation.pathname = "/manage/page"; const second = render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "discard"}}); fireEvent.click(screen.getByText("schedule")); fireEvent.click(screen.getByText(t("manage.unsaved.discard"))); second.unmount();
        navigation.pathname = "/manage/page_"; render(view()); expect(screen.getByLabelText("name")).toHaveProperty("value", "retain");
    });
    it("does not ask for hash-only history navigation", () => {
        const replace = window.history.replaceState;
        const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
        render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}});
        replace.call(window.history, {...window.history.state, cibDraftIndex: -1}, "", "/manage/settings#part");
        act(() => window.dispatchEvent(new PopStateEvent("popstate", {state: window.history.state})));
        expect(go).not.toHaveBeenCalled(); expect(screen.queryByText(t("manage.unsaved.title"))).toBeNull();
        expect(screen.getByLabelText("name")).toHaveProperty("value", "local"); go.mockRestore();
    });
    it("guards forward navigation after a clean return to an older unstamped entry", () => {
        const replace = window.history.replaceState;
        const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
        const rendered = render(view());
        const prior = {...window.history.state};
        replace.call(window.history, {}, "", "/manage/older");
        act(() => window.dispatchEvent(new PopStateEvent("popstate", {state: {}})));
        expect(window.history.state.cibDraftIndex).toBe(0);
        navigation.pathname = "/manage/older"; rendered.rerender(view());
        fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}});
        replace.call(window.history, prior, "", "/manage/settings");
        act(() => window.dispatchEvent(new PopStateEvent("popstate", {state: window.history.state})));
        expect(go).not.toHaveBeenCalled(); expect(window.location.pathname).toBe("/manage/older"); expect(screen.getByText(t("manage.unsaved.title"))).toBeTruthy(); go.mockRestore();
    });
    it("confirms history navigation only after the browser restores the departed entry", async () => {
        const replace = window.history.replaceState;
        const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
        render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}});
        replace.call(window.history, {...window.history.state, cibDraftIndex: -1}, "", "/manage/older");
        act(() => window.dispatchEvent(new PopStateEvent("popstate", {state: window.history.state})));
        fireEvent.click(screen.getByText(t("manage.unsaved.discard")));
        expect(go).toHaveBeenCalledTimes(1);
        replace.call(window.history, {...window.history.state, cibDraftIndex: 0}, "", "/manage/settings");
        await act(async () => window.dispatchEvent(new PopStateEvent("popstate", {state: window.history.state})));
        expect(go).toHaveBeenLastCalledWith(-1); expect(Object.keys(sessionStorage)).toHaveLength(0); go.mockRestore();
    });

    it("ignores a save completion captured before the authenticated user changes", () => {
        let previousSave!: () => void;
        function ScopedForm() {
            const [value, setValue] = useSessionDraftState<string | null>("name", null);
            return <><input aria-label="scoped" value={value ?? "server"} onChange={event => setValue(event.target.value)} /><button onClick={() => {previousSave = () => setValue(null);}}>capture save</button></>;
        }
        const scoped = (userID: string) => <ManualDraftProvider userID={userID} eventID="event-a"><ScopedForm /></ManualDraftProvider>;
        const rendered = render(scoped("user-a")); fireEvent.change(screen.getByLabelText("scoped"), {target: {value: "user-a-edit"}}); fireEvent.click(screen.getByText("capture save"));
        rendered.rerender(scoped("user-b")); expect(screen.getByLabelText("scoped")).toHaveProperty("value", "server");
        fireEvent.change(screen.getByLabelText("scoped"), {target: {value: "user-b-edit"}}); act(() => previousSave()); expect(screen.getByLabelText("scoped")).toHaveProperty("value", "user-b-edit");
        rendered.rerender(scoped("user-a")); expect(screen.getByLabelText("scoped")).toHaveProperty("value", "user-a-edit");
    });

    it("uses the native index for a forward entry created before mounting", () => {
        const replace = window.history.replaceState;
        const position = {index: 1}; Object.defineProperty(window, "navigation", {configurable: true, value: {currentEntry: position}});
        const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
        render(view()); fireEvent.change(screen.getByLabelText("name"), {target: {value: "local"}});
        position.index = 2; replace.call(window.history, {}, "", "/manage/forward");
        act(() => window.dispatchEvent(new PopStateEvent("popstate", {state: {}})));
        expect(go).toHaveBeenCalledWith(-1); expect(screen.getByText(t("manage.unsaved.title"))).toBeTruthy();
        position.index = 1; replace.call(window.history, {}, "", "/manage/settings"); act(() => window.dispatchEvent(new PopStateEvent("popstate", {state: {}})));
        fireEvent.click(screen.getByText(t("common.cancel"))); expect(window.location.pathname).toBe("/manage/settings"); expect(screen.getByLabelText("name")).toHaveProperty("value", "local");
        go.mockRestore(); Reflect.deleteProperty(window, "navigation");
    });

    it("keeps a clean editor visible and spaces typable without storing obsolete values", () => {
        function Editor() {
            const [edit, setEdit] = useSessionDraftState<{name: string} | null>("editor", null);
            useDraftDirty("editor", !!edit && edit.name.trim() !== "server", {preserveInput: true});
            return edit ? <input aria-label="editor" value={edit.name} onChange={event => setEdit({name: event.target.value})} /> : <button onClick={() => setEdit({name: "server"})}>open editor</button>;
        }
        render(<ManualDraftProvider userID="user-a" eventID="event-a"><Editor /></ManualDraftProvider>);
        fireEvent.click(screen.getByText("open editor")); expect(screen.getByLabelText("editor")).toHaveProperty("value", "server");
        fireEvent.change(screen.getByLabelText("editor"), {target: {value: "server "}}); expect(screen.getByLabelText("editor")).toHaveProperty("value", "server "); expect(Object.keys(sessionStorage)).toHaveLength(0);
        fireEvent.change(screen.getByLabelText("editor"), {target: {value: "server next"}}); expect(Object.keys(sessionStorage)).toHaveLength(1);
    });

});
