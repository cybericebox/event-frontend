import {describe, expect, it} from "vitest";
import {agoText, deviceStateLabel, failureReasonLabel, queueLineStaff, sizeText, startingNote} from "./labLive";

const queue = {Position: 2, Length: 5, Reason: "WaitingForTurn", Message: "", Pods: 3, Pending: 3};

describe("lab live text", () => {
    it("tells staff how many labs are ahead, without the total", () => {
        expect(queueLineStaff({...queue, Position: 3, Reason: "PreparingImages"})).toBe("У черзі, перед нею ще 2. Готуємо образи пристроїв.");
        expect(queueLineStaff({...queue, Position: 1, Reason: "WaitingForTurn"})).toBe("Наступна в черзі.");
        expect(queueLineStaff(queue)).toBe("У черзі, перед нею ще 1.");
        expect(queueLineStaff({...queue, Reason: "TenantQuota"})).toContain("ліміту");
        expect(queueLineStaff({...queue, Reason: "SomethingNew"})).not.toContain("SomethingNew");
    });

    it("shows no line when no queue exists or everything is dispatched", () => {
        expect(queueLineStaff(null)).toBeNull();
        expect(queueLineStaff({...queue, Position: 0})).toBeNull();
    });

    it("picks the second line by reason, only after the long wait", () => {
        expect(startingNote(queue, false)).toBeNull();
        expect(startingNote(queue, true)).toContain("Ще трохи");
        expect(startingNote(null, true)).toContain("Ще трохи");
        for (const Reason of ["InsufficientResources", "NoSchedulableNodes", "TenantQuota"]) {
            expect(startingNote({...queue, Reason}, true)).toBe("Зараз бракує ресурсів. Лабораторія запуститься, щойно вони звільняться.");
            expect(startingNote({...queue, Reason}, false)).toBeNull();
        }
        for (const Reason of ["InFlightLimit", "WaitingForGroup", "WaitingForTurn", "PreparingImages", ""]) {
            expect(startingNote({...queue, Reason}, true)).toContain("Ще трохи");
        }
    });

    it("formats the age and the size", () => {
        const now = Date.parse("2026-01-01T12:00:00Z");
        expect(agoText("2026-01-01T11:55:00Z", now)).toBe("5 хвилин тому");
        expect(sizeText(2048)).toBe("2 КБ");
    });

    it("names the state of a device", () => {
        const device = {Name: "db", Ready: false, Reason: "", Scheduling: {State: "Queued", QueuedAt: null, DispatchedAt: null, StartedAt: null, Failure: null}, Snapshot: null};
        expect(deviceStateLabel(device)).toBe("У черзі");
        expect(deviceStateLabel({...device, Ready: true})).toBe("Готовий");
    });
});

describe("standReasonText: ImageUnavailable", () => {
    it("names the image and never shows the raw code", async () => {
        const {standReasonText} = await import("./labLive");
        expect(standReasonText("ImageUnavailable: acme/web:1")).toBe("Образ недоступний: acme/web:1");
        expect(standReasonText("ImageUnavailable")).toBe("Образ недоступний");
        expect(standReasonText("something else")).toBe("something else");
        expect(failureReasonLabel("ImageUnavailable")).toBe("образ недоступний");
    });
});
