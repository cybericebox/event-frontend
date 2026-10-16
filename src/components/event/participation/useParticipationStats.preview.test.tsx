// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, renderHook, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {fixtureChallenge} from "../challenges/fixtures/challengeFixture";
import {useParticipationStats} from "./useParticipationStats";

const api = vi.hoisted(() => ({board: vi.fn(), competition: vi.fn()}));
vi.mock("@/api/participantPreview", () => ({getPreviewBoard: api.board, previewBoardKey: (eventID: string) => ["event-participant-preview-board", eventID]}));
vi.mock("@/api/participationStats", async importOriginal => ({...await importOriginal<typeof import("@/api/participationStats")>(), getParticipationStats: api.competition}));
vi.mock("../ParticipantPreview", () => ({useParticipantPreview: () => ({active: true, state: {userID: "user", team: {ID: "browser-team", Name: "Browser team"}}})}));
afterEach(() => {cleanup(); vi.clearAllMocks();});

it("fills both participation tabs from owned preview progress without querying the moderators team", async () => {
    api.board.mockResolvedValue({Challenges: [{...fixtureChallenge, SolvedAt: "2026-10-16T10:00:00Z", Points: 50, AwardedPoints: 50, PreviewAttempts: 2, PreviewCorrectAttempts: 1, Hints: []}]});
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const {result} = renderHook(() => useParticipationStats("event", {preview: true, enabled: true}), {wrapper: ({children}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>});
    await waitFor(() => expect(result.current.stats?.Points).toBe(50));
    expect(result.current.stats?.Team).toMatchObject({TeamID: "browser-team", TeamName: "Browser team", Attempts: 2, CorrectAttempts: 1});
    expect(api.competition).not.toHaveBeenCalled();
    expect(client.getQueryData(["event-participation-stats", "event", "moderators"])).toBeUndefined();
});
