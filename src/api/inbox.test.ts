import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.test"}));

const {getInbox, markInboxAllRead, getInboxSince, resolveInboxRequest, InboxError} = await import("./inbox");

function reply(status: number, body: unknown) {
    return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}}));
}

describe("inbox API", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("parses categorized items and keeps older ones working", async () => {
        const fetch = reply(200, {Data: {NextCursor: "", Items: [
            {ID: "a", Title: "t", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-29T10:00:00Z", Type: "event.lab.failed", Category: "requests", ActionRequired: true, ResolvedAt: null, Resolution: null, ResolvedBy: null},
            {ID: "b", Title: "t", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-29T09:00:00Z"},
        ]}});
        vi.stubGlobal("fetch", fetch);
        const page = await getInbox("?site=event&category=requests&event=e1");
        expect(fetch.mock.calls[0][0]).toBe("https://api.test/api/notifications/inbox?site=event&category=requests&event=e1");
        expect(page.Items[0]).toMatchObject({Category: "requests", ActionRequired: true, Type: "event.lab.failed"});
        expect(page.Items[1].Category).toBeUndefined();
    });

    it("keeps Resolvable and the other server fields of a real-shaped item", async () => {
        const item = {
            ID: "a", Title: "Лабораторія впала", Body: "b", Link: "/manage/labs", Icon: "server", Tone: "danger", AccentColor: "", Surface: "dropdown",
            AutoDismissMs: null, Actions: null, Dismissible: true, ReadAt: null, CreatedAt: "2026-10-21T10:00:00Z", EventID: "e1", EventName: "Захід", EventTag: "ev",
            Type: "event.lab.failed", Category: "requests", ActionRequired: true, ResolvedAt: null, Resolution: null, ResolvedBy: null, Resolvable: true,
        };
        vi.stubGlobal("fetch", reply(200, {Status: {Code: 0}, Data: {Items: [item], NextCursor: ""}}));
        const page = await getInbox("?site=event");
        expect(page.Items[0]).toMatchObject({Resolvable: true, Surface: "dropdown", Dismissible: true});
        const { canResolve } = await import("@/components/event/inboxModel");
        expect(canResolve(page.Items[0] as never)).toBe(true);
    });

    it("reads the news after a cursor, oldest first, with Counts and OtherEventsCount", async () => {
        const fetch = reply(200, {Data: {Cursor: "c2", Items: [], Unread: 2, Counts: {All: 3, Requests: 1, Personal: 1, Activity: 1}, OtherEventsCount: 4}});
        vi.stubGlobal("fetch", fetch);
        expect(await getInboxSince("e1", "c1")).toMatchObject({Cursor: "c2", Counts: {All: 3}, OtherEventsCount: 4});
        expect(fetch.mock.calls[0][0]).toBe("https://api.test/api/notifications/inbox?site=event&event=e1&since=c1");
        expect(fetch.mock.calls[0][1]).not.toHaveProperty("cache");
        const second = reply(200, {Data: {Cursor: "c3", Items: [], Unread: 0}});
        vi.stubGlobal("fetch", second);
        await getInboxSince("e1", "");
        expect(second.mock.calls[0][0]).toBe("https://api.test/api/notifications/inbox?site=event&event=e1&since=");
    });

    it("turns an empty NextCursor into no next page", async () => {
        vi.stubGlobal("fetch", reply(200, {Data: {Items: [], NextCursor: ""}}));
        expect((await getInbox("?site=event")).NextCursor).toBeNull();
    });

    it("marks a tab read and resolves by id", async () => {
        const fetch = reply(200, {Data: null});
        vi.stubGlobal("fetch", fetch);
        await markInboxAllRead("?site=event&category=personal&event=e1");
        await resolveInboxRequest("x/1");
        expect(fetch.mock.calls.map(call => [call[0], call[1].method])).toEqual([
            ["https://api.test/api/notifications/inbox/read-all?site=event&category=personal&event=e1", "PATCH"],
            ["https://api.test/api/notifications/inbox/x%2F1/resolve", "POST"],
        ]);
    });

    it("carries the backend detail code on failure", async () => {
        vi.stubGlobal("fetch", reply(409, {Status: {Code: 70219, Message: "already resolved"}}));
        const error = await resolveInboxRequest("x").catch(err => err);
        expect(error).toBeInstanceOf(InboxError);
        expect(error).toMatchObject({status: 409, code: 219});
    });
});
