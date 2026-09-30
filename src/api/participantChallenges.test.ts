import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.test"}));
const {getChallengeSolves, ParticipantChallengeError, SOLVES_PAGE_SIZE} = await import("./participantChallenges");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status});

describe("getChallengeSolves", () => {
    it("asks the first page without a cursor and reads the wrapped page", async () => {
        fetchMock.mockResolvedValue(reply({Data: {Total: 2, Items: [{TeamName: "Альфа", SolvedAt: "2026-01-01T10:00:00Z", Own: false, FirstBlood: true}], NextCursor: "11111111-1111-4111-8111-111111111111"}}));
        const page = await getChallengeSolves("e1", "c1");
        expect(fetchMock.mock.calls[0][0]).toBe(`https://api.test/api/events/e1/teams/challenges/c1/solves?pageSize=${SOLVES_PAGE_SIZE}`);
        expect(page.Items[0].FirstBlood).toBe(true);
        expect(page.NextCursor).toBe("11111111-1111-4111-8111-111111111111");
    });

    it("sends the cursor and treats a missing NextCursor and null Items as the last, empty page", async () => {
        fetchMock.mockResolvedValue(reply({Data: {Total: 0, Items: null}}));
        const page = await getChallengeSolves("e1", "c1", "22222222-2222-4222-8222-222222222222");
        expect(String(fetchMock.mock.calls[0][0])).toContain("cursor=22222222-2222-4222-8222-222222222222");
        expect(page).toEqual({Total: 0, Items: [], NextCursor: null});
    });

    it("uses the moderators board URL for the organizer preview", async () => {
        fetchMock.mockResolvedValue(reply({Data: {Total: 0, Items: []}}));
        await getChallengeSolves("e1", "c1", null, true);
        expect(String(fetchMock.mock.calls[0][0])).toContain("/api/events/e1/manage/labs/moderators/challenges/c1/solves?");
    });

    it("carries the results-denied code of a 403", async () => {
        fetchMock.mockResolvedValue(reply({Status: {Code: 61213}}, 403));
        await expect(getChallengeSolves("e1", "c1")).rejects.toMatchObject({status: 403, code: 1213});
        expect(ParticipantChallengeError).toBeTruthy();
    });
});
