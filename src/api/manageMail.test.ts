import {describe, expect, it} from "vitest";
import {
    emptyMailJournalFilters, journalTarget, mailJournalQueryParams, mailSettingsError, mailSettingsInput,
    mailTransportLabel, smtpError, smtpForm, smtpInput, type MailJournalItem,
} from "./manageMail";

describe("event mail settings form", () => {
    it("accepts an empty contact address and reminder hours 0–168", () => {
        expect(mailSettingsError({contactEmail: "", startReminderHours: "0"})).toBe("");
        expect(mailSettingsError({contactEmail: "team@example.com", startReminderHours: "168"})).toBe("");
        expect(mailSettingsError({contactEmail: "nope", startReminderHours: "24"})).not.toBe("");
        expect(mailSettingsError({contactEmail: "", startReminderHours: "169"})).not.toBe("");
        expect(mailSettingsError({contactEmail: "", startReminderHours: "2.5"})).not.toBe("");
        expect(mailSettingsError({contactEmail: "", startReminderHours: ""})).not.toBe("");
    });

    it("trims the payload", () => {
        expect(mailSettingsInput({contactEmail: " team@example.com ", startReminderHours: " 12 "})).toEqual({ContactEmail: "team@example.com", StartReminderHours: 12});
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
