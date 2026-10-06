import {afterEach, beforeEach, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.example.com"}));

import {getOwnTeamMembers, regenerateEventTeamCode} from "./eventTeams";

const fetchMock = vi.fn();
beforeEach(() => {vi.stubGlobal("fetch", fetchMock);});
afterEach(() => {fetchMock.mockReset(); vi.unstubAllGlobals();});

it("sends the chosen expiry when the join link is reissued", async () => {
    fetchMock.mockResolvedValue(new Response("{}", {status: 200}));
    await regenerateEventTeamCode("e1", "t1", "week");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/events/e1/teams/t1/join-code");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({Expiry: "week"});
});

it("reads pending invitees of the roster", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({Data: [
        {UserID: id, DisplayName: "Олена", Role: 0, Own: true},
        {UserID: id, DisplayName: "Іван", Role: 1, Own: false, Pending: true},
    ]}), {status: 200}));
    const members = await getOwnTeamMembers("e1");
    expect(members.map(member => member.Pending)).toEqual([false, true]);
});
