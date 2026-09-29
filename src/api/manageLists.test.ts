import {afterEach, describe, expect, it, vi} from "vitest";
vi.mock("@/utils/origins", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/utils/origins")>(),
    requireApiOrigin: () => "https://api.example.org",
}));
import {getManageParticipants} from "./manageParticipants";
import {getManageTeams} from "./manageTeams";

afterEach(() => {vi.unstubAllGlobals();});

const eventID = "01900000-0000-7000-8000-000000000001";

function stubList() {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({Data: {Items: [], Total: 0}}), {status: 200}));
    vi.stubGlobal("fetch", fetchMock);
    return () => new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
}

describe("manage list requests", () => {
    it("sends participant search, kind and page size", async () => {
        const url = stubList();
        await getManageParticipants(eventID, {kind: "applications", status: 3, search: "  Олена "}, null, 50);
        expect(url().pathname).toBe(`/api/events/${eventID}/manage/participants`);
        expect(Object.fromEntries(url().searchParams)).toEqual({pageSize: "50", kind: "applications", status: "3", search: "Олена"});
    });

    it("omits a blank participant search", async () => {
        const url = stubList();
        await getManageParticipants(eventID, {kind: "participants", search: "   "}, "01900000-0000-7000-8000-000000000002");
        expect(url().searchParams.has("search")).toBe(false);
        expect(url().searchParams.get("cursor")).toBe("01900000-0000-7000-8000-000000000002");
    });

    it("sends team search, admission filter and page size", async () => {
        const url = stubList();
        await getManageTeams(eventID, null, {search: "Blue", admission: "notAdmitted"}, 100);
        expect(url().pathname).toBe(`/api/events/${eventID}/manage/teams`);
        expect(Object.fromEntries(url().searchParams)).toEqual({pageSize: "100", search: "Blue", admission: "notAdmitted"});
    });

    it("sends answer filters as a JSON array", async () => {
        const url = stubList();
        await getManageParticipants(eventID, {kind: "participants", fields: [{Key: "city", Op: "contains", Value: "Київ"}, {Key: "agree", Op: "bool", Value: true}]}, null);
        expect(JSON.parse(url().searchParams.get("filters") ?? "")).toEqual([{Key: "city", Op: "contains", Value: "Київ"}, {Key: "agree", Op: "bool", Value: true}]);
    });

    it("omits empty answer filters for teams", async () => {
        const url = stubList();
        await getManageTeams(eventID, null, {fields: []});
        expect(url().searchParams.has("filters")).toBe(false);
    });

    it("keeps the default team page without filters", async () => {
        const url = stubList();
        await getManageTeams(eventID, null);
        expect(Object.fromEntries(url().searchParams)).toEqual({pageSize: "20"});
    });
});
