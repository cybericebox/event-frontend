import {describe, expect, it} from "vitest";
import {agoText, deviceStateLabel, failureReasonLabel, queueLine, sizeText} from "./labLive";

const queue = {Position: 2, Length: 5, Reason: "WaitingForTurn", Message: "", Pods: 3, Pending: 3};

describe("lab live text", () => {
    it("says where the lab stands in the queue, with a human reason", () => {
        expect(queueLine(queue)).toBe("Лабораторія в черзі: 2 із 5. Чекаємо своєї черги.");
    });

    it("shows no queue when none exists or everything is dispatched", () => {
        expect(queueLine(null)).toBeNull();
        expect(queueLine({...queue, Position: 0})).toBeNull();
    });

    it("has a text for the tenant quota reason", () => {
        expect(queueLine({...queue, Reason: "TenantQuota"})).toContain("ліміту");
    });

    it("never shows a raw reason code", () => {
        expect(queueLine({...queue, Reason: "SomethingNew"})).not.toContain("SomethingNew");
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
