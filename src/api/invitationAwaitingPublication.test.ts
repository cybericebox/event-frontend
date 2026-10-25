import {describe, expect, it} from "vitest";
import {participantSchema} from "./manageParticipants";
import {joinInfoSchema} from "./clientAuth";

const row = {
    UserID: "11111111-1111-4111-8111-111111111111", Name: "Олена", Email: "o@test.test", TeamID: null, Hidden: false,
    Status: 1, CreatedAt: "2026-09-01T10:00:00Z", DecidedAt: null,
};

describe("InvitationAwaitingPublication", () => {
    it("defaults to false when the backend does not send it yet", () => {
        expect(participantSchema.parse(row).InvitationAwaitingPublication).toBe(false);
        expect(joinInfoSchema.parse({Status: 1}).InvitationAwaitingPublication).toBe(false);
    });

    it("reads the flag on a participant row and on the join info", () => {
        expect(participantSchema.parse({...row, Invited: true, InvitationAwaitingPublication: true}).InvitationAwaitingPublication).toBe(true);
        expect(joinInfoSchema.parse({Status: 1, Invited: true, InvitationAwaitingPublication: true, InvitationExpired: false})).toMatchObject({InvitationAwaitingPublication: true, InvitationExpired: false});
    });
});
