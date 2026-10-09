import {afterEach, describe, expect, it, vi} from "vitest";
vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.test"}));
import {LabPolicySchema, ManageConfigSchema, getManageConfig, manageConfigInput, putManageConfig} from "./manage";
const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); afterEach(() => fetchMock.mockReset());
const raw = {EventID: "00000000-0000-4000-8000-000000000001", Participation: 1, Registration: 2, ScoreboardVisibility: 1, ParticipantsVisibility: 2,
    PreviewDescription: "existing", PreviewPicture: "picture", MaxTeamSize: 8, MinTeamSize: 2, MaxTeams: 14, AllowPseudonyms: true,
    ShowDifficulty: false, HintsDisabled: true, HintChargeMode: "balance", MaxFlagAttempts: 13, TaskRevealMode: "as_ready",
    Theme: {Brand: "#123456", Accent: "#654321", AccentLight: "#654321", AccentDark: "#654321", AccentLive: "#654321", Version: 1}, UpdatedAt: "2026-10-08T12:00:00Z"};
const policy = {SnapshotMode: "required" as const, MaxActiveLabsPerTeam: 7, RetentionMinutes: 90};
describe("event lifecycle config transport", () => {
    it("preserves every existing full-payload value and sends the frozen policy", async () => {
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({Data: {...raw, LabPolicy: policy}})));
        const config = await getManageConfig("event /");
        const input = manageConfigInput(config);
        await putManageConfig("event /", input);
        expect(fetchMock.mock.calls[1][0]).toBe("https://api.test/api/events/event%20%2F/manage/config");
        expect(fetchMock.mock.calls[1][1]).toMatchObject({method: "PUT", credentials: "include", cache: "no-store"});
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({...input, LabPolicy: policy});
        for (const key of ["Participation", "Registration", "ScoreboardVisibility", "ParticipantsVisibility", "PreviewDescription", "PreviewPicture", "MaxTeamSize", "MinTeamSize", "MaxTeams", "AllowPseudonyms", "ShowDifficulty", "HintsDisabled", "HintChargeMode", "MaxFlagAttempts", "TaskRevealMode"] as const) expect(input[key]).toEqual(raw[key]);
    });
    it("keeps legacy missing policy absent from PUT and never supplies product defaults", () => {
        const config = ManageConfigSchema.parse(raw);
        expect(config.LabPolicy).toBeNull();
        expect(manageConfigInput(config)).not.toHaveProperty("LabPolicy");
    });
    it("accepts unlimited active Labs and zero retention, rejects out of range or fractional inputs", () => {
        expect(LabPolicySchema.parse({...policy, MaxActiveLabsPerTeam: null, RetentionMinutes: 0})).toMatchObject({MaxActiveLabsPerTeam: null, RetentionMinutes: 0});
        for (const fields of [{MaxActiveLabsPerTeam: 0}, {MaxActiveLabsPerTeam: 1001}, {RetentionMinutes: 10081}, {RetentionMinutes: 1.5}]) expect(LabPolicySchema.safeParse({...policy, ...fields}).success).toBe(false);
    });
});
