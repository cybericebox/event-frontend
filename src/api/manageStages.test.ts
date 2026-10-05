import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.test"}));
const {createManageStage, deleteManageStage, getManageStages, setExerciseStage, updateManageStage} = await import("./manageStages");
const {ManageApiError} = await import("./manage");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status});
const stage = {ID: "11111111-1111-4111-8111-111111111111", Name: "Один", OpensAt: "2026-10-01T10:00:00Z", ClosesAt: "2026-10-01T12:00:00Z", Returnable: true, State: "open", First: true, Last: false};

describe("manage stages API", () => {
    it("lists the stages and fills the optional fields", async () => {
        fetchMock.mockResolvedValue(reply({Data: [stage]}));
        const list = await getManageStages("e1");
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/events/e1/manage/stages");
        expect(list[0]).toMatchObject({State: "open", DeployLeadMinutes: 0});
        fetchMock.mockResolvedValue(reply({Data: null}));
        expect(await getManageStages("e1")).toEqual([]);
    });

    it("creates, updates (partial, with «Закрити зараз»), and deletes", async () => {
        fetchMock.mockImplementation(async () => reply({Data: stage}));
        await createManageStage("e1", {Name: "Один", OpensAt: stage.OpensAt, ClosesAt: stage.ClosesAt, Returnable: false});
        expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "POST", body: JSON.stringify({Name: "Один", OpensAt: stage.OpensAt, ClosesAt: stage.ClosesAt, Returnable: false})});
        await updateManageStage("e1", stage.ID, {CloseNow: true});
        expect(fetchMock.mock.calls[1][0]).toBe(`https://api.test/api/events/e1/manage/stages/${stage.ID}`);
        expect(fetchMock.mock.calls[1][1]).toMatchObject({method: "PUT", body: JSON.stringify({CloseNow: true})});
        fetchMock.mockImplementation(async () => reply({Data: null}));
        await deleteManageStage("e1", stage.ID);
        expect(fetchMock.mock.calls[2][1]).toMatchObject({method: "DELETE"});
    });

    it("puts a set on a stage, or back on the whole event with null", async () => {
        fetchMock.mockImplementation(async () => reply({Data: {}}));
        await setExerciseStage("e1", "a1", stage.ID);
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/events/e1/manage/exercises/a1/stage");
        expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "PUT", body: JSON.stringify({StageID: stage.ID})});
        await setExerciseStage("e1", "a1", null);
        expect(fetchMock.mock.calls[1][1]).toMatchObject({body: JSON.stringify({StageID: null})});
    });

    it("carries the detail code of a refused change", async () => {
        fetchMock.mockResolvedValue(reply({Status: {Code: 71149}}, 409));
        await expect(updateManageStage("e1", stage.ID, {Name: "x"})).rejects.toMatchObject({status: 409, code: 1149});
        expect(ManageApiError).toBeTruthy();
    });
});
