import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.test"}));

const {getInbox, markInboxAllRead, pollInbox, resolveInboxRequest, InboxError} = await import("./inbox");

function reply(status: number, body: unknown) {
    return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}}));
}

describe("inbox API", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("parses categorized items and keeps older ones working", async () => {
        const fetch = reply(200, {Data: {NextCursor: null, Items: [
            {ID: "a", Title: "t", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-29T10:00:00Z", Type: "event.lab.failed", Category: "requests", ActionRequired: true, ResolvedAt: null, Resolution: null, ResolvedBy: null},
            {ID: "b", Title: "t", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-29T09:00:00Z"},
        ]}});
        vi.stubGlobal("fetch", fetch);
        const page = await getInbox("?category=requests&event=e1");
        expect(fetch.mock.calls[0][0]).toBe("https://api.test/api/notifications/inbox?category=requests&event=e1");
        expect(page.Items[0]).toMatchObject({Category: "requests", ActionRequired: true, Type: "event.lab.failed"});
        expect(page.Items[1].Category).toBeUndefined();
    });

    it("passes Counts and OtherEventsCount through, absent on older backends", async () => {
        vi.stubGlobal("fetch", reply(200, {Data: {Cursor: null, NewInbox: [], UnreadCount: 2, Counts: {All: 3, Requests: 1, Personal: 1, Activity: 1}, OtherEventsCount: 4}}));
        expect(await pollInbox("?event=e1")).toMatchObject({Counts: {All: 3}, OtherEventsCount: 4});
        vi.stubGlobal("fetch", reply(200, {Data: {Cursor: null, NewInbox: [], UnreadCount: 2}}));
        expect((await pollInbox("")).Counts).toBeUndefined();
    });

    it("marks a tab read and resolves by id", async () => {
        const fetch = reply(200, {Data: null});
        vi.stubGlobal("fetch", fetch);
        await markInboxAllRead("?category=personal&event=e1");
        await resolveInboxRequest("x/1");
        expect(fetch.mock.calls.map(call => [call[0], call[1].method])).toEqual([
            ["https://api.test/api/notifications/inbox/read-all?category=personal&event=e1", "PATCH"],
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
