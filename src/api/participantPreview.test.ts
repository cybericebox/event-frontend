import {afterEach, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.test"}));
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());
const reply = (Data: unknown, status = 200) => new Response(JSON.stringify({Data}), {status});
const taskID = "11111111-1111-4111-8111-111111111111";
const selection = "22222222-2222-4222-8222-222222222222";

it("keeps all static task operations inside the event preview namespace", async () => {
    const api = await import("./participantPreview");
    const task = {EventChallengeID: taskID, PreviewSelectionID: selection};
    fetchMock.mockResolvedValueOnce(reply({Correct: true}));
    expect((await api.submitPreviewFlag("event", task, "flag")).Correct).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({Flag: "flag"});
    fetchMock.mockResolvedValueOnce(reply({ID: "h1", Content: "Revealed", Cost: 0, Unlocked: true}));
    expect((await api.unlockPreviewHint("event", task, "h1")).Content).toBe("Revealed");
    fetchMock.mockResolvedValueOnce(reply({Items: [], NextCursor: null}));
    await api.getPreviewSolves("event", task);
    expect(api.previewFileUrl("event", task, "file")).toContain(`/manage/participant-preview/selections/${selection}/tasks/${taskID}/files/file`);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("/manage/participant-preview/"))).toBe(true);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/teams/"))).toBe(true);
});

it("starts explicitly and reads provisioning, ready and capacity refusal without a fallback", async () => {
    const api = await import("./participantPreview");
    fetchMock.mockResolvedValueOnce(reply({ID: taskID, SelectionID: selection, Dynamic: true, ExpiresAt: "2026-10-16T12:00:00Z"}));
    await api.startPreviewRun("event", selection);
    fetchMock.mockResolvedValueOnce(reply({Phase: "pending", Ready: false}));
    expect((await api.getPreviewLab("event", selection)).Ready).toBe(false);
    fetchMock.mockResolvedValueOnce(reply({Phase: "ready", Ready: true, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://lab.test"}]}));
    expect((await api.getPreviewLab("event", selection)).Access).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(reply({}, 409));
    await expect(api.startPreviewRun("event", selection)).rejects.toMatchObject({status: 409});
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("/manage/participant-preview/"))).toBe(true);
});

it("separates the same catalog task in different selections and preserves its API identity", async () => {
    const api = await import("./participantPreview");
    const common = {ID: taskID, EventChallengeID: taskID, Snapshot: {name: "Task", difficulty: "easy"}, Readiness: 2, SolvedAt: null, Points: 100, Order: 0, GroupID: null, GroupName: "", GroupOrder: 0};
    fetchMock.mockResolvedValueOnce(reply({ServerNow: "2026-10-16T12:00:00Z", Challenges: [{...common, PreviewSelectionID: selection}, {...common, PreviewSelectionID: taskID}]}));
    const board = await api.getPreviewBoard("event");
    expect(new Set(board.Challenges.map(task => task.EventChallengeID)).size).toBe(2);
    expect(api.previewFileUrl("event", board.Challenges[0], "file")).toContain(`/selections/${selection}/tasks/${taskID}/files/file`);
});

it("fails closed for a missing preview selection and strips expired runtime access", async () => {
    const api = await import("./participantPreview");
    expect(() => api.submitPreviewFlag("event", {EventChallengeID: taskID}, "flag")).toThrow("selection identity");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(reply({Phase: "ready", Ready: true, Expired: true, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://expired.test"}]}));
    expect(await api.getPreviewLab("event", selection)).toMatchObject({Ready: false, Access: []});
});

it("preview sends the chosen length", async () => {
    const api = await import("./participantPreview");
    fetchMock.mockResolvedValueOnce(reply({ID: "run", SelectionID: selection, Dynamic: true, ExpiresAt: null}));
    await api.startPreviewRun("event", selection, 45);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/manage/participant-preview/selections/${selection}/start`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({LeaseMinutes: 45});
    fetchMock.mockResolvedValueOnce(reply({ID: "run", SelectionID: selection, Dynamic: true, ExpiresAt: null}));
    await api.startPreviewRun("event", selection);
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
});

it("fences a manual modal start at the shared API boundary during preview cleanup", async () => {
    const api = await import("./participantPreview");
    const {suspendPreviewRunStarts} = await import("./previewRunLifecycle");
    const barrier = suspendPreviewRunStarts("event");
    try {
        await expect(api.startPreviewRun("event", selection, 45)).rejects.toThrow("cleanup");
        expect(fetchMock).not.toHaveBeenCalled();
    } finally {barrier.release();}
});
