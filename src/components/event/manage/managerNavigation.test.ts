import {describe, expect, it} from "vitest";
import {managerCrumbs, managerLocationTitle} from "./managerNavigation";

describe("manager location titles", () => {
    it("names a template page after its signal", () => {
        expect(managerLocationTitle("/manage/email/participant.event.finished", [])).toBe("Захід завершено");
        expect(managerLocationTitle("/manage/notifications/participant.event.start_reminder", [])).toBe("Нагадування про старт");
    });

    it("keeps the list and journal titles", () => {
        expect(managerLocationTitle("/manage/email", [])).toBe("Електронні листи");
        expect(managerLocationTitle("/manage/mail-journal", [])).toBe("Журнал надсилання");
    });

    it("shows the section and the page as a trail", () => {
        expect(managerCrumbs("/manage/exercise-groups", [])?.map(crumb => crumb.label)).toEqual(["Завдання", "Групи й порядок"]);
        expect(managerCrumbs("/manage/analytics/tasks", [])?.[0].label).toBe("Аналітика");
        expect(managerCrumbs("/manage/broadcasts/new", [])?.map(crumb => crumb.href)).toEqual([undefined, "/manage/broadcasts", undefined]);
    });

    it("shows a top-level page as a single name", () => {
        expect(managerCrumbs("/manage", [])).toEqual([{label: "Підготовка заходу"}]);
    });

    it("names no section for an unknown address", () => {
        expect(managerCrumbs("/manage/challenges/", [])).toBeNull();
        expect(managerCrumbs("/manage/nowhere", [])).toBeNull();
        expect(managerLocationTitle("/manage/nowhere", [])).toBeNull();
    });
});
