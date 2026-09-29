import {afterEach, describe, expect, it, vi} from "vitest";
import {ApiErrorCode} from "./apiErrors";
import {ManageApiError} from "./manage";
vi.mock("@/utils/origins", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/utils/origins")>(),
    requireApiOrigin: () => "https://api.example.org",
}));
import * as api from "./manageChallenges";

afterEach(() => vi.unstubAllGlobals());

const eventID = "01900000-0000-7000-8000-000000000001";
const uid = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const base = `https://api.example.org/api/events/${eventID}/manage`;

function stubFetch(body: unknown, status = 200) {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), {status}));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

const attachment = (n: number, extra: Record<string, unknown> = {}) => ({
    ID: uid(n), ExerciseID: uid(n + 1), ExerciseName: "Основи кібербезпеки", ExerciseVersionID: uid(n + 2), VariantMode: 0, FixedVariantIndex: null,
    Revision: 2, Status: 0, ReplacesID: null, SupersededAt: null, CreatedAt: "2026-09-26T00:00:00Z", ...extra,
});
const challenge = {
    ID: uid(11), TaskID: uid(12), GroupID: null, PrerequisiteIDs: null, Order: 0, Points: 100, ScoringOverride: null, HintsEnabled: true, Published: true,
    Snapshot: {name: "Перший крок"},
    Hints: [{ID: uid(111), Text: "Заголовки", Level: "steps", Cost: 15, Overridden: true}, {ID: uid(112), Text: "Cookie", Cost: 0, Overridden: false}],
};

describe("event challenge scoring", () => {
    it("sends a local algorithm and null to return to the event profile", async () => {
        const fetchMock = stubFetch({Data: {updated: 1}});
        const override = {Mode: 1 as const, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50};
        await api.updateEventChallengeScoring(eventID, uid(10), uid(11), override);
        await api.updateEventChallengeScoring(eventID, uid(10), uid(11), null);
        const [[url, init], [, reset]] = fetchMock.mock.calls;
        expect(url).toBe(`${base}/exercises/${uid(10)}/challenges/scoring`);
        expect(init).toMatchObject({method: "PUT", body: JSON.stringify({ChallengeIDs: [uid(11)], Override: override})});
        expect(reset.body).toBe(JSON.stringify({ChallengeIDs: [uid(11)], Override: null}));
    });
});

describe("catalog preview", () => {
    it("requests the variant and parses the tasks", async () => {
        const fetchMock = stubFetch({Data: {ID: uid(13), Name: "Набір", Description: "", VersionID: uid(14), VariantCount: 2, Variant: 1,
            Tasks: [{Name: "Перший крок", Difficulty: "easy", HintCount: 2}, {Name: "Фінальне завдання", Difficulty: "medium"}]}});
        const preview = await api.getPublishedExercisePreview(eventID, uid(14), 1);
        expect(fetchMock.mock.calls[0][0]).toBe(`${base}/exercise-catalog/${uid(14)}?variant=1`);
        expect(preview.Variant).toBe(1);
        expect(preview.Tasks.map(task => task.HintCount)).toEqual([2, 0]);
    });

    it("sends the search and infrastructure filters", async () => {
        const fetchMock = stubFetch({Data: [{ID: uid(30), Name: "Мережевий аналіз", Description: "", PublishedVersionID: uid(31), Tags: null, Scope: "event", Infrastructure: true, Attached: true}]});
        const [choice] = await api.getPublishedExerciseChoices(eventID, "мережа", "yes");
        expect(fetchMock.mock.calls[0][0]).toBe(`${base}/exercise-catalog?search=${encodeURIComponent("мережа")}&infrastructure=yes`);
        expect(choice).toMatchObject({Scope: "event", Infrastructure: true, Attached: true, Tags: []});
        await api.getPublishedExerciseChoices(eventID, "");
        expect(fetchMock.mock.calls[1][0]).toBe(`${base}/exercise-catalog?search=`);
    });
});

describe("attachments", () => {
    it("parses catalog versions, forks and detached sets", async () => {
        stubFetch({Data: [
            attachment(10, {Scope: "catalog", VersionNumber: 2, LatestVersionID: uid(21), LatestVersionNumber: 3, UpdateAvailable: true}),
            attachment(20, {Scope: "event", Fork: {SourceExerciseID: uid(15), SourceExerciseName: "Мережевий аналіз", SourceVersionID: uid(16), SourceVersionNumber: 1,
                SourceLatestVersionID: uid(22), SourceLatestVersionNumber: 2, SourceUpdateAvailable: true}}),
            attachment(40, {Scope: "event"}),
            attachment(50, {Status: 2, DetachedAt: "2026-09-28T10:00:00Z"}),
        ]});
        const [catalog, fork, own, detached] = await api.getEventExerciseAttachments(eventID);
        expect(catalog).toMatchObject({Scope: "catalog", VersionNumber: 2, LatestVersionNumber: 3, UpdateAvailable: true, Fork: null});
        expect(fork.Fork).toMatchObject({SourceVersionNumber: 1, SourceLatestVersionNumber: 2, SourceUpdateAvailable: true});
        expect(own).toMatchObject({Scope: "event", Fork: null});
        expect(detached).toMatchObject({Status: 2, DetachedAt: "2026-09-28T10:00:00Z"});
    });

    it("accepts a legacy attachment without the W4 fields", () => {
        const legacy = api.EventExerciseAttachmentSchema.parse({
            ID: eventID, ExerciseID: eventID, ExerciseName: "Набір", ExerciseVersionID: eventID, VariantMode: 0, FixedVariantIndex: null,
            Revision: 3, Status: 0, ReplacesID: null, SupersededAt: null, CreatedAt: "2026-09-26T00:00:00Z",
        });
        expect(legacy).toMatchObject({Scope: "catalog", VersionNumber: 0, UpdateAvailable: false, Fork: null, DetachedAt: null});
    });

    it("posts update, fork and revert to their routes", async () => {
        const fetchMock = stubFetch({Data: attachment(10)});
        await api.updateEventExercise(eventID, uid(10));
        await api.updateEventExercise(eventID, uid(10), uid(21));
        await api.forkEventExercise(eventID, uid(10));
        await api.revertEventExercise(eventID, uid(10));
        expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([
            [`${base}/exercises/${uid(10)}/update`, "POST", "{}"],
            [`${base}/exercises/${uid(10)}/update`, "POST", JSON.stringify({ExerciseVersionID: uid(21)})],
            [`${base}/exercises/${uid(10)}/fork`, "POST", undefined],
            [`${base}/exercises/${uid(10)}/revert`, "POST", undefined],
        ]);
    });

    it("maps the detach confirmation conflict and confirms with a query flag", async () => {
        stubFetch({Status: {Code: 40000 + ApiErrorCode.ExerciseDetachNeedsConfirm}}, 409);
        const error = await api.detachEventExercise(eventID, uid(10)).catch((value: unknown) => value);
        expect(error).toBeInstanceOf(ManageApiError);
        expect(error).toMatchObject({status: 409, code: ApiErrorCode.ExerciseDetachNeedsConfirm});
        const fetchMock = stubFetch({Data: null});
        await expect(api.detachEventExercise(eventID, uid(10), true)).resolves.toBeUndefined();
        expect(fetchMock.mock.calls[0][0]).toBe(`${base}/exercises/${uid(10)}?confirm=true`);
        expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    });
});

describe("hints", () => {
    it("sends hint costs and parses the updated challenge", async () => {
        const fetchMock = stubFetch({Data: challenge});
        const changed = await api.updateEventChallengeHintCosts(eventID, uid(10), uid(11), [{HintID: uid(111), Cost: 15}, {HintID: uid(112), Cost: null}]);
        expect(fetchMock.mock.calls[0][0]).toBe(`${base}/exercises/${uid(10)}/challenges/${uid(11)}/hints`);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "PUT", body: JSON.stringify({Costs: [{HintID: uid(111), Cost: 15}, {HintID: uid(112), Cost: null}]})});
        expect(changed.PrerequisiteIDs).toEqual([]);
        expect(changed.Hints[0]).toMatchObject({Cost: 15, Level: "steps", Overridden: true});
        expect(changed.Hints[1]).toMatchObject({Cost: 0, Level: "nudge", Overridden: false});
    });

    it("maps invalid hint costs", async () => {
        stubFetch({Status: {Code: 40000 + ApiErrorCode.HintCostsInvalid}}, 400);
        await expect(api.updateEventChallengeHintCosts(eventID, uid(10), uid(11), [{HintID: uid(111), Cost: -1}]))
            .rejects.toMatchObject({status: 400, code: ApiErrorCode.HintCostsInvalid});
    });

    it("parses hint unlocks and treats null as empty", async () => {
        stubFetch({Data: [{TeamID: uid(801), TeamName: "Frost Wolves", EventChallengeID: uid(11), ChallengeName: "Перший крок", HintID: uid(112), HintIndex: 1,
            UnlockedBy: null, UnlockedByName: "", UnlockedAt: "2026-09-29T10:42:00Z", Cost: 30}]});
        const [unlock] = await api.getHintUnlocks(eventID);
        expect(unlock).toMatchObject({HintIndex: 1, Cost: 30, UnlockedBy: null});
        stubFetch({Data: null});
        expect(await api.getHintUnlocks(eventID)).toEqual([]);
    });
});
