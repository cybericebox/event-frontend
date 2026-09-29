import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
vi.mock("@/utils/origins", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/utils/origins")>(),
    requireApiOrigin: () => "https://api.example.org",
}));
import {reportTaskOpened, resetTaskOpenedBeacon, TASK_OPENED_WINDOW_MS} from "./taskOpenedBeacon";

const eventID = "01900000-0000-7000-8000-000000000001";
const challengeID = "01900000-0000-7000-8000-000000000002";

beforeEach(() => resetTaskOpenedBeacon());
afterEach(() => vi.unstubAllGlobals());

describe("task_opened beacon", () => {
    it("posts to the open endpoint with the session and without waiting", () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(null, {status: 204}));
        vi.stubGlobal("fetch", fetcher);
        reportTaskOpened(eventID, challengeID, 1000);
        expect(fetcher).toHaveBeenCalledWith(`https://api.example.org/api/events/${eventID}/teams/challenges/${challengeID}/open`, expect.objectContaining({method: "POST", credentials: "include", keepalive: true}));
    });

    it("reports the same task once per window and other tasks at once", () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(null, {status: 204}));
        vi.stubGlobal("fetch", fetcher);
        reportTaskOpened(eventID, challengeID, 1000);
        reportTaskOpened(eventID, challengeID, 1000 + TASK_OPENED_WINDOW_MS - 1);
        expect(fetcher).toHaveBeenCalledTimes(1);
        reportTaskOpened(eventID, "01900000-0000-7000-8000-000000000003", 2000);
        expect(fetcher).toHaveBeenCalledTimes(2);
        reportTaskOpened(eventID, challengeID, 1000 + TASK_OPENED_WINDOW_MS);
        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it("swallows a failing request and a throwing fetch", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        expect(() => reportTaskOpened(eventID, challengeID, 1000)).not.toThrow();
        vi.stubGlobal("fetch", vi.fn(() => {throw new Error("sync failure");}));
        expect(() => reportTaskOpened(eventID, "01900000-0000-7000-8000-000000000009", 1000)).not.toThrow();
        await Promise.resolve();
    });
});
