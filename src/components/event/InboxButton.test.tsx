// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {ManualDraftProvider, useSessionDraftState} from "./manage/manualDraft";
import {t} from "@/i18n/t";

const api = vi.hoisted(() => ({
    getInbox: vi.fn(), pollInbox: vi.fn(), markInboxRead: vi.fn(), markInboxAllRead: vi.fn(), resolveInboxRequest: vi.fn(),
}));
vi.mock("@/api/inbox", () => ({...api, InboxError: class extends Error { code?: number }}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage/settings", useRouter: () => ({push: vi.fn(), replace: vi.fn()})}));
const {InboxButton} = await import("./InboxButton");

const lab = (id: string, extra = {}) => ({
    ID: id, Title: `Заявка ${id}`, Body: "", Link: "", ReadAt: null, CreatedAt: "2026-10-01T10:00:00Z",
    Type: "event.lab.failed", Resolvable: true, Category: "requests", ActionRequired: true, ResolvedAt: null, ...extra,
});
const poll = {Cursor: null, UnreadCount: 2, Counts: {All: 2, Requests: 2, Personal: 0, Activity: 0}, NewInbox: [], OtherEventsCount: 0};

beforeEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    HTMLElement.prototype.scrollTo = () => {};
    api.pollInbox.mockResolvedValue(poll);
    api.getInbox.mockResolvedValue({Items: [lab("a"), lab("b")], NextCursor: null});
    api.resolveInboxRequest.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function EditedPage() {
    const [value, setValue] = useSessionDraftState("inbox-form", "");
    return <input aria-label="draft" value={value} onChange={event => setValue(event.target.value)} />;
}

HTMLDialogElement.prototype.showModal ??= function () {this.setAttribute("open", "");};
HTMLDialogElement.prototype.close ??= function () {this.removeAttribute("open");};

async function openInbox() {
    render(<InboxButton event={{id: "e1", otherEventsHref: "/"}} />);
    fireEvent.click(screen.getByRole("button", {name: /Вхідні/}));
    await screen.findByText("Заявка a");
}

describe("inbox", () => {
    it.each(["list", "pop-in"])("guards the %s navigation before marking the notification read", async mode => {
        const message = lab("a", {Link: "/manage/schedule", Actions: [{label: "notification action", href: "/manage/schedule"}]});
        api.getInbox.mockResolvedValue({Items: [message], NextCursor: null});
        api.markInboxRead.mockImplementationOnce(() => new Promise(() => {}));
        api.pollInbox.mockResolvedValueOnce(poll).mockResolvedValue({...poll, UnreadCount: 3, NewInbox: [message]});
        render(<ManualDraftProvider userID="user-a" eventID="e1"><EditedPage /><InboxButton event={{id: "e1", otherEventsHref: "/"}} /></ManualDraftProvider>);
        await waitFor(() => expect(api.getInbox).toHaveBeenCalled());
        if (mode === "list") fireEvent.click(screen.getByRole("button", {name: /Вхідні/}));
        else act(() => window.dispatchEvent(new Event("cybericebox:inbox-updated")));
        const action = mode === "list" ? await screen.findByRole("link", {name: t("inbox.open")}) : await screen.findByRole("button", {name: "notification action"});
        fireEvent.change(screen.getByLabelText("draft"), {target: {value: "keep this"}});
        fireEvent.click(action);
        expect(api.markInboxRead).not.toHaveBeenCalled();
        expect(screen.getByText(t("manage.unsaved.title"))).toBeTruthy();
        fireEvent.click(screen.getByText(t("common.cancel")));
        expect(screen.getByLabelText("draft")).toHaveProperty("value", "keep this");
        expect(api.markInboxRead).not.toHaveBeenCalled();
        if (mode === "list") {
            fireEvent.click(screen.getByRole("button", {name: /Вхідні/}));
            fireEvent.click(await screen.findByRole("link", {name: t("inbox.open")}));
        } else fireEvent.click(action);
        fireEvent.click(screen.getByText(t("manage.unsaved.discard")));
        expect(api.markInboxRead).toHaveBeenCalledExactlyOnceWith("a");
        expect(screen.queryByText(t("manage.unsaved.title"))).toBeNull();
    });

    it("keeps a polite live region mounted before any pop-in arrives", async () => {
        render(<InboxButton event={{id: "e1", otherEventsHref: "/"}} />);
        await waitFor(() => expect(document.querySelector(".event-notifications__popins[aria-live=polite]")).toBeTruthy());
    });

    it("resolves a request at once and keeps the other resolve buttons enabled while the save is pending", async () => {
        let finish: () => void = () => {};
        api.resolveInboxRequest.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        await openInbox();
        const buttons = screen.getAllByRole("button", {name: "Вирішено"});
        fireEvent.click(buttons[0]);
        // optimistic: the first row is resolved before the server answers, the second button is still enabled
        await waitFor(() => expect(screen.getAllByRole("button", {name: "Вирішено"})).toHaveLength(1));
        expect((screen.getByRole("button", {name: "Вирішено"}) as HTMLButtonElement).disabled).toBe(false);
        await act(async () => { finish(); });
    });

    it("rolls back and shows the reason when the resolve fails", async () => {
        api.resolveInboxRequest.mockRejectedValueOnce(new Error("no"));
        await openInbox();
        fireEvent.click(screen.getAllByRole("button", {name: "Вирішено"})[0]);
        await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
        expect(api.getInbox.mock.calls.length).toBeGreaterThan(1);
        await waitFor(() => expect(screen.getAllByRole("button", {name: "Вирішено"})).toHaveLength(2));
    });

    it("keeps the previous items while another tab loads", async () => {
        await openInbox();
        api.getInbox.mockImplementationOnce(() => new Promise(() => {}));
        fireEvent.click(screen.getByRole("tab", {name: /Особисті|Особисте/}));
        expect(screen.getByText("Заявка a")).toBeTruthy();
    });

    it("marks unread rows with the word «Нове» and no dot", async () => {
        await openInbox();
        expect(document.querySelector(".event-notification-card__unread")).toBeNull();
        expect(screen.getAllByText(t("inbox.unreadItem")).length).toBe(2);
    });

    it("a read open request still says «Потребує дії», is not «Нове», and the bell says what it counts", async () => {
        const alarm = {...lab("alarm", {Type: "resources.alarm.raised", Resolvable: true, ReadAt: "2026-10-01T10:05:00Z"})};
        api.pollInbox.mockResolvedValue({...poll, UnreadCount: 0, Counts: {All: 1, Requests: 1, Personal: 0, Activity: 0}});
        api.getInbox.mockResolvedValue({Items: [alarm], NextCursor: null});
        render(<InboxButton event={{id: "e1", otherEventsHref: "/"}} />);
        const bell = await screen.findByRole("button", {name: t("inbox.titleRequests", {count: 1})});
        fireEvent.click(bell);
        await screen.findByText("Заявка alarm");
        expect(screen.getByText(t("inbox.needsAction"))).toBeTruthy();
        expect(screen.queryByText(t("inbox.unreadItem"))).toBeNull();
        expect(screen.getByRole("button", {name: "Вирішено"})).toBeTruthy();
        expect(screen.getByRole("tab", {name: t("inbox.tabCountRequests", {name: t("inbox.tab.requests"), count: 1})})).toBeTruthy();
    });

    it("a resolved request carries neither tag", async () => {
        const closed = lab("done", {ReadAt: "2026-10-01T10:05:00Z", ResolvedAt: "2026-10-01T10:06:00Z", Resolution: "resolved"});
        api.pollInbox.mockResolvedValue({...poll, UnreadCount: 0, Counts: {All: 0, Requests: 0, Personal: 0, Activity: 0}});
        api.getInbox.mockResolvedValue({Items: [closed], NextCursor: null});
        render(<InboxButton event={{id: "e1", otherEventsHref: "/"}} />);
        fireEvent.click(await screen.findByRole("button", {name: /Вхідні/}));
        await screen.findByText("Заявка done");
        expect(screen.queryByText(t("inbox.needsAction"))).toBeNull();
        expect(screen.queryByText(t("inbox.unreadItem"))).toBeNull();
    });
});
