import {describe, expect, it} from "vitest";
import {managerLocationTitle} from "./managerNavigation";

describe("manager location titles", () => {
    it("names a template page after its signal", () => {
        expect(managerLocationTitle("/manage/email/participant.event.finished", [])).toBe("Захід завершено");
        expect(managerLocationTitle("/manage/notifications/participant.event.start_reminder", [])).toBe("Нагадування про старт");
    });

    it("keeps the list and journal titles", () => {
        expect(managerLocationTitle("/manage/email", [])).toBe("Електронні листи");
        expect(managerLocationTitle("/manage/mail-journal", [])).toBe("Журнал надсилання");
    });
});
