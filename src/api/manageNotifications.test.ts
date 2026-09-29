import {describe, expect, it} from "vitest";
import en from "../../messages/en.json";
import uk from "../../messages/uk.json";
import {channelSignals, reminderDays, signalGroups, signalLabel, signalLabels, validReminderDays} from "./manageNotifications";

describe("notification signal labels", () => {
    it("labels the W7 types and drops the declined invitation", () => {
        expect(signalLabel("participant.event.start_reminder").title).toBe("Нагадування про старт");
        expect(signalLabel("participant.event.finished").title).toBe("Захід завершено");
        expect(signalLabel("participant.team_invitation.sent").title).toBe("Запрошення до команди");
        expect(signalLabels).not.toHaveProperty("participant.invitation.declined");
        expect(signalLabel("custom.type")).toEqual({title: "custom.type", description: "", group: "Інше"});
    });

    it("lists the channel's rows in label order with unknown types last", () => {
        const rows = [
            {SignalType: "custom.type", Channel: "email"},
            {SignalType: "participant.event.finished", Channel: "email"},
            {SignalType: "participant.invitation.sent", Channel: "email"},
            {SignalType: "participant.invitation.sent", Channel: "email"},
            {SignalType: "participant.approval_registration.approved", Channel: "in_app"},
        ];
        expect(channelSignals(rows, "email")).toEqual(["participant.invitation.sent", "participant.event.finished", "custom.type"]);
        expect(channelSignals(rows, "in_app")).toEqual(["participant.approval_registration.approved"]);
    });

    it("groups signals keeping their order", () => {
        expect(signalGroups(["participant.invitation.sent", "participant.event.finished", "custom.type"]))
            .toEqual([{group: "Запрошення", signals: ["participant.invitation.sent"]}, {group: "Захід", signals: ["participant.event.finished"]}, {group: "Інше", signals: ["custom.type"]}]);
    });
});

// Mirrors AP Backend notificationTypes.EventScopedTypes(): the signals an Event can list.
const eventScopedSignals = [
    "participant.approval_registration.submitted", "participant.approval_registration.approved", "participant.approval_registration.rejected",
    "participant.open_registration.completed", "participant.invitation.sent", "participant.team_invitation.sent",
    "participant.invitation.accepted", "participant.invitation.revoked", "participant.invitation.expired",
    "participant.event.start_reminder", "participant.event.finished", "participant.event.results_published",
];

describe("every event-scoped signal is translated", () => {
    it.each([["uk", uk], ["en", en]] as const)("has %s title, description and a known group", (_lang, messages) => {
        const catalog = messages as Record<string, string>;
        for (const type of eventScopedSignals) {
            expect(signalLabels, type).toHaveProperty(type);
            expect(catalog[`manage.notifications.signal.${type}.title`]?.trim(), type).toBeTruthy();
            expect(catalog[`manage.notifications.signal.${type}.description`]?.trim(), type).toBeTruthy();
        }
    });

    it("never falls back to the raw type name for a known signal", () => {
        for (const type of eventScopedSignals) {
            const label = signalLabel(type);
            expect(label.title).not.toBe(type);
            expect(label.title).not.toContain(".");
            expect(label.group).not.toBe("Інше");
        }
    });
});

describe("start reminder timing", () => {
    it("reads days_before_start and defaults to 7", () => {
        expect(reminderDays(undefined)).toBe(7);
        expect(reminderDays({Config: {}})).toBe(7);
        expect(reminderDays({Config: {days_before_start: 3}})).toBe(3);
        expect(reminderDays({Config: {days_before_start: "3"}})).toBe(7);
    });

    it("accepts whole days from 1 to 30", () => {
        expect([1, 7, 30].every(validReminderDays)).toBe(true);
        expect([0, 31, 2.5, NaN].some(validReminderDays)).toBe(false);
    });
});
