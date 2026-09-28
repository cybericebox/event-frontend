import {describe, expect, it} from "vitest";
import {formatAnswer, moveColumn, resolveColumns, toSavedColumns} from "./listColumns";
import {participantTabFromParams, participantTabHref} from "./participantTabs";

const fields = [{key: "city", label: "Місто"}, {key: "age", label: "Вік"}, {key: "role", label: ""}];

describe("extra-field columns", () => {
    it("shows every field in form order without a saved config", () => {
        expect(resolveColumns(fields, [])).toEqual([
            {key: "city", label: "Місто", visible: true},
            {key: "age", label: "Вік", visible: true},
            {key: "role", label: "role", visible: true},
        ]);
    });

    it("keeps the saved order and visibility, drops removed fields and appends new ones", () => {
        const columns = resolveColumns(fields, [{Key: "age", Visible: false}, {Key: "gone", Visible: true}, {Key: "city", Visible: true}, {Key: "age", Visible: true}]);
        expect(columns.map(column => [column.key, column.visible])).toEqual([["age", false], ["city", true], ["role", true]]);
    });

    it("moves a column within bounds and serialises the result", () => {
        const columns = resolveColumns(fields, []);
        expect(moveColumn(columns, 0, -1)).toBe(columns);
        expect(moveColumn(columns, 2, 1)).toBe(columns);
        const moved = moveColumn(columns, 1, -1);
        expect(toSavedColumns(moved)).toEqual([{Key: "age", Visible: true}, {Key: "city", Visible: true}, {Key: "role", Visible: true}]);
    });

    it("formats answers for cells", () => {
        expect(formatAnswer(undefined)).toBe("—");
        expect(formatAnswer("")).toBe("—");
        expect(formatAnswer(true)).toBe("Так");
        expect(formatAnswer(["a", "b"])).toBe("a · b");
        expect(formatAnswer(3)).toBe("3");
    });
});

describe("participant tabs", () => {
    it("maps the tab parameter and the legacy status link", () => {
        expect(participantTabFromParams("invitations")).toBe("invitations");
        expect(participantTabFromParams("unknown")).toBe("participants");
        expect(participantTabFromParams(undefined, "pending")).toBe("applications");
        expect(participantTabFromParams(null)).toBe("participants");
        expect(participantTabHref("participants")).toBe("/manage/participants");
        expect(participantTabHref("applications")).toBe("/manage/participants?tab=applications");
    });
});
