// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";

const api = vi.hoisted(() => ({
    getInbox: vi.fn(), pollInbox: vi.fn(), markInboxRead: vi.fn(), markInboxAllRead: vi.fn(), resolveInboxRequest: vi.fn(),
}));
vi.mock("@/api/inbox", () => ({...api, InboxError: class extends Error { code?: number }}));
const {InboxButton} = await import("./InboxButton");

const lab = (id: string, extra = {}) => ({
    ID: id, Title: `Заявка ${id}`, Body: "", Link: "", ReadAt: null, CreatedAt: "2026-10-01T10:00:00Z",
    Type: "event.lab.failed", Category: "requests", ActionRequired: true, ResolvedAt: null, ...extra,
});
const poll = {Cursor: null, UnreadCount: 2, Counts: {All: 2, Requests: 2, Personal: 0, Activity: 0}, NewInbox: [], OtherEventsCount: 0};

beforeEach(() => {
    vi.useRealTimers();
    HTMLElement.prototype.scrollTo = () => {};
    api.pollInbox.mockResolvedValue(poll);
    api.getInbox.mockResolvedValue({Items: [lab("a"), lab("b")], NextCursor: null});
    api.resolveInboxRequest.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function openInbox() {
    render(<InboxButton event={{id: "e1", otherEventsHref: "/"}} />);
    fireEvent.click(screen.getByRole("button", {name: /Вхідні/}));
    await screen.findByText("Заявка a");
}

describe("inbox", () => {
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

    it("does not announce the unread state with a dot", async () => {
        await openInbox();
        expect(document.querySelector(".event-notification-card__unread")).toBeNull();
        expect(screen.getAllByText("Непрочитане").length).toBeGreaterThan(0);
    });
});
