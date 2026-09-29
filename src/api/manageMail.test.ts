import {describe, expect, it} from "vitest";
import {
    emptyMailJournalFilters, identityError, identityForm, identityInput, journalTarget, mailJournalQueryParams,
    mailTransportLabel, smtpError, smtpForm, smtpInput, type MailJournalItem,
} from "./manageMail";

describe("event mail identity form", () => {
    const empty = {senderName: "", senderAddress: "", replyToName: "", replyToAddress: ""};

    it("starts from the event's own values", () => {
        expect(identityForm({Sender: {Name: "CTF", Address: "ctf@example.com"}, ReplyTo: {Name: "", Address: "team@example.com"}}))
            .toEqual({senderName: "CTF", senderAddress: "ctf@example.com", replyToName: "", replyToAddress: "team@example.com"});
    });

    it("accepts empty fields (they inherit) and valid addresses", () => {
        expect(identityError(empty)).toBe("");
        expect(identityError({...empty, senderAddress: "ctf@example.com", replyToAddress: "team@example.com"})).toBe("");
    });

    it("rejects bad addresses and names over 64 characters", () => {
        expect(identityError({...empty, senderAddress: "nope"})).toBe("senderAddress");
        expect(identityError({...empty, replyToAddress: "a@b"})).toBe("replyToAddress");
        expect(identityError({...empty, senderName: "x".repeat(65)})).toBe("senderName");
        expect(identityError({...empty, senderName: "x".repeat(64)})).toBe("");
        expect(identityError({...empty, replyToName: "x".repeat(65)})).toBe("replyToName");
    });

    it("trims the payload", () => {
        expect(identityInput({senderName: " CTF ", senderAddress: " a@b.co ", replyToName: "", replyToAddress: " r@b.co "}))
            .toEqual({Sender: {Name: "CTF", Address: "a@b.co"}, ReplyTo: {Name: "", Address: "r@b.co"}});
    });
});

describe("event SMTP form", () => {
    it("starts from the stored SMTP without the password", () => {
        expect(smtpForm(null)).toEqual({host: "", port: "587", tlsMode: "starttls", username: "", password: "", clearPassword: false});
        expect(smtpForm({Host: "smtp.example.com", Port: 465, TLSMode: "tls", Username: "u", PasswordSet: true, UpdatedAt: null}))
            .toEqual({host: "smtp.example.com", port: "465", tlsMode: "tls", username: "u", password: "", clearPassword: false});
    });

    it("validates host and port", () => {
        const form = smtpForm(null);
        expect(smtpError(form)).not.toBe("");
        expect(smtpError({...form, host: "smtp.example.com"})).toBe("");
        expect(smtpError({...form, host: "smtp.example.com", port: "0"})).not.toBe("");
        expect(smtpError({...form, host: "smtp.example.com", port: "65536"})).not.toBe("");
    });

    it("keeps the stored password when empty and drops a typed one on clear", () => {
        const form = {host: " smtp.example.com ", port: "587", tlsMode: "starttls" as const, username: " u ", password: "", clearPassword: false};
        expect(smtpInput(form)).toEqual({Host: "smtp.example.com", Port: 587, TLSMode: "starttls", Username: "u", Password: "", ClearPassword: false});
        expect(smtpInput({...form, password: "secret"}).Password).toBe("secret");
        expect(smtpInput({...form, password: "secret", clearPassword: true})).toMatchObject({Password: "", ClearPassword: true});
    });
});

describe("mail journal", () => {
    it("maps filters to query parameters", () => {
        expect(mailJournalQueryParams(emptyMailJournalFilters).toString()).toBe("limit=25&channel=email");
        expect(mailJournalQueryParams({type: "participant.event.finished", result: "error", transport: "event", channel: "email"}, "c1", 10).toString())
            .toBe("limit=10&channel=email&type=participant.event.finished&result=error&transport=event&cursor=c1");
    });

    it("picks the target of the shown channel", () => {
        const target = {Channel: "email", Status: "done", Error: "", Attempts: 2, Transport: "platform", Recipient: "a@b.c", FallbackError: "timeout", UpdatedAt: "2026-09-29T08:00:00Z"};
        const item: MailJournalItem = {ID: "1", NotificationType: "t", Status: "done", CreatedAt: "", UpdatedAt: "", RecipientEmail: "", Targets: [{...target, Channel: "in_app"}, target]};
        expect(journalTarget(item, "email")).toBe(target);
        expect(journalTarget({...item, Targets: []}, "email")).toBeNull();
    });

    it("labels transports in Ukrainian", () => {
        expect(mailTransportLabel("event")).toBe("SMTP заходу");
        expect(mailTransportLabel("platform")).toBe("Платформа");
        expect(mailTransportLabel("env")).toBe("Резервний (env)");
        expect(mailTransportLabel("")).toBe("—");
    });
});
