import {describe, expect, it} from "vitest";
import {fieldColumnDefinitions, formatAnswer, moveColumn, resolveTableColumns, toSavedColumns, type TableColumn} from "./listColumns";
import {participantTabFromParams, participantTabHref} from "./participantTabs";

const fields = [{key: "city", label: "Місто"}, {key: "age", label: "Вік"}, {key: "role", label: ""}];

describe("table columns", () => {
    const defaults = [{key: "@name", label: "Ім’я", locked: true}, {key: "@email", label: "Пошта"}, {key: "@date", label: "Дата"}, ...fieldColumnDefinitions(fields.map(field => ({...field, id: field.key, type: "field" as const, input: "text" as const})))];
    const keys = (columns: TableColumn[]) => columns.map(column => [column.key, column.visible]);

    it("shows every column in default order without a saved layout", () => {
        expect(keys(resolveTableColumns(defaults, []))).toEqual([["@name", true], ["@email", true], ["@date", true], ["city", true], ["age", true], ["role", true]]);
        expect(resolveTableColumns(defaults, [])[5].label).toBe("role");
    });

    it("keeps saved order and visibility, drops unknown keys and places missing columns after their default predecessor", () => {
        const columns = resolveTableColumns(defaults, [{Key: "age", Visible: false}, {Key: "gone", Visible: true}, {Key: "city", Visible: true}, {Key: "age", Visible: true}, {Key: "@name", Visible: false}]);
        // A layout saved before standard columns were configurable: @email and
        // @date follow @name; role follows its default predecessor age.
        expect(keys(columns)).toEqual([["@name", true], ["@email", true], ["@date", true], ["age", false], ["role", true], ["city", true]]);
    });

    it("keeps the locked column first and moves others by index", () => {
        const columns = resolveTableColumns(defaults, [{Key: "city", Visible: true}, {Key: "@name", Visible: true}]);
        expect(columns[0].key).toBe("@name");
        expect(moveColumn(columns, 1, 0)).toBe(columns);
        expect(moveColumn(columns, 0, 2)).toBe(columns);
        expect(moveColumn(columns, 1, 9)).toBe(columns);
        const moved = moveColumn(columns, 5, 1);
        expect(moved.map(column => column.key)).toEqual(["@name", columns[5].key, ...columns.slice(1, 5).map(column => column.key)]);
        expect(toSavedColumns(moved)[0]).toEqual({Key: "@name", Visible: true});
    });
});

describe("answer cells", () => {
    it("formats answers for cells", () => {
        expect(formatAnswer(undefined)).toBe("—");
        expect(formatAnswer("")).toBe("—");
        expect(formatAnswer(true)).toBe("Так");
        expect(formatAnswer(["a", "b"])).toBe("a · b");
        expect(formatAnswer(3)).toBe("3");
        expect(formatAnswer({id: "f", name: "cv.pdf"})).toBe("cv.pdf");
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
