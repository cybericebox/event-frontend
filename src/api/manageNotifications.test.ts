import {describe, expect, it} from "vitest";
import {channelSignals, signalGroups, signalLabel, signalLabels} from "./manageNotifications";

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
            .toEqual([{group: "Запрошення", signals: ["participant.invitation.sent"]}, {group: "Подія", signals: ["participant.event.finished"]}, {group: "Інше", signals: ["custom.type"]}]);
    });
});
