import {describe, expect, it} from "vitest";
import {canRecreate, orderStands, standStatusLabel, standStatusTone, standTeamName} from "./standStatus";

const stand = (teamID: string, moderators: boolean) => ({TeamID: teamID, TeamName: `T-${teamID}`, Moderators: moderators, Status: "ready" as const, Reason: "", UpdatedAt: null, Generation: 0, Labs: []});

describe("stand status", () => {
    it("labels every status in Ukrainian", () => {
        expect(Object.values(standStatusLabel)).toEqual(["Не розгорнуто", "Створюється", "Готово", "Помилка", "Видалено"]);
        expect(standStatusTone.failed).toBe("danger");
    });

    it("allows recreate only for an existing stand", () => {
        expect(canRecreate("failed")).toBe(true);
        expect(canRecreate("ready")).toBe(true);
        expect(canRecreate("not_deployed")).toBe(false);
        expect(canRecreate("removed")).toBe(false);
    });

    it("puts the moderators team first under its own label", () => {
        const ordered = orderStands([stand("a", false), stand("m", true)]);
        expect(ordered.map(item => item.TeamID)).toEqual(["m", "a"]);
        expect(standTeamName(ordered[0])).toBe("Команда модераторів");
    });
});
