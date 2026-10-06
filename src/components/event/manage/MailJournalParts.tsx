"use client";

import Link from "next/link";
import {smtpErrorLine, type MailJournalItem} from "@/api/manageMail";
import {t} from "@/i18n/t";
import "./journal.css";

// The recipient user of a message: the name line, then the email muted. Without
// a name only the email; without both a dash.
export function MailRecipient({name, email}: {name: string; email: string}) {
    if (!name && !email) return <span className="event-manage-table__dim">—</span>;
    if (!name) return <>{email}</>;
    return <span className="event-manage-table__person"><strong>{name}</strong>{email && <small>{email}</small>}</span>;
}

const nilUUID = "00000000-0000-0000-0000-000000000000";

// The one recipient row of the details: «Name (email)», email alone without a
// name, a dash without both. Links to the participant when the user id is real.
export function DetailRecipient({item}: {item: MailJournalItem}) {
    const name = item.RecipientName.trim();
    const email = item.RecipientEmail.trim();
    if (!name && !email) return <span className="event-manage-table__dim">—</span>;
    const text = name && email ? t("manage.mail.journal.detail.recipientFull", {name, email}) : name || email;
    const id = item.RecipientUserID?.trim() ?? "";
    if (!id || id === nilUUID) return <>{text}</>;
    return <Link className="ib-link" href={`/manage/participants?participant=${encodeURIComponent(id)}`}>{text}</Link>;
}

// A send failure: the human text of a known SMTP error kind with the raw
// server text under «Технічні деталі»; anything else is the raw text itself.
export function MailErrorText({kind, code, raw, wrapKey, className}: {kind: string; code: string; raw: string; wrapKey?: string; className?: string}) {
    const line = smtpErrorLine(kind, code, raw);
    return <div className={className}>
        <span>{wrapKey ? t(wrapKey, {error: line.text}) : line.text}</span>
        {line.technical && <details className="event-mail-technical"><summary>{t("manage.mail.journal.technical")}</summary><code>{line.technical}</code></details>}
    </div>;
}
