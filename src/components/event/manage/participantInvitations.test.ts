import {describe, expect, it} from "vitest";
import {invitationEmails, parseInvitationCsv} from "./participantInvitations";

describe("participant invitation CSV", () => {
    it("finds the email column and preserves quoted commas and line breaks", () => {
        const csv = '\uFEFFname,email\r\n"Коваль, Олена",Olena@Example.test\r\n"Іван\nМельник",ivan@example.test\r\n';
        expect(parseInvitationCsv(csv)).toEqual(["Olena@Example.test", "ivan@example.test"]);
    });

    it("combines manual and CSV addresses without duplicates", () => {
        expect(invitationEmails("A@example.test\nb@example.test", ["a@example.test", "c@example.test"]))
            .toEqual(["a@example.test", "b@example.test", "c@example.test"]);
    });
});
