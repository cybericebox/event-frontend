import {describe, expect, it} from "vitest";
import {smtpErrorLine, targetRecipient, type MailJournalItem, type MailJournalTarget} from "./manageMail";

const raw = "535 5.7.8 Authentication credentials invalid";

describe("smtpErrorLine", () => {
    it.each([
        ["smtp_auth", "SMTP-сервер відхилив вхід: перевірте логін і пароль SMTP"],
        ["smtp_rcpt", "Адресу одержувача відхилено"],
        ["smtp_rejected", "Лист відхилено сервером (можливо, адресу не підтверджено в SES)"],
        ["smtp_connect", "Не вдалося з'єднатися з SMTP-сервером"],
    ])("maps %s to human text and keeps the raw text as details", (kind, text) => {
        expect(smtpErrorLine(kind, "", raw)).toEqual({text, technical: raw});
    });

    it("puts the reply code into smtp_other, and drops it when empty", () => {
        expect(smtpErrorLine("smtp_other", "554", raw)).toEqual({text: "Помилка SMTP (554)", technical: raw});
        expect(smtpErrorLine("smtp_other", "", raw)).toEqual({text: "Помилка SMTP", technical: raw});
    });

    it("shows the raw text for an unknown or empty kind", () => {
        expect(smtpErrorLine("", "", "Відкладено: ліміт")).toEqual({text: "Відкладено: ліміт", technical: ""});
        expect(smtpErrorLine("smtp_future", "", raw)).toEqual({text: raw, technical: ""});
    });
});

describe("targetRecipient", () => {
    const item = {RecipientEmail: "a@x.io", RecipientName: ""} as MailJournalItem;
    it("prefers the target user, falls back to the item", () => {
        expect(targetRecipient(item, {Recipient: "u@x.io", RecipientName: "Ірина"} as MailJournalTarget)).toEqual({name: "Ірина", email: "u@x.io"});
        expect(targetRecipient(item, null)).toEqual({name: "", email: "a@x.io"});
    });
});
