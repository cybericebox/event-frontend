"use client";

import {smtpErrorLine} from "@/api/manageMail";
import {t} from "@/i18n/t";
import "./journal.css";

// The recipient user of a message: the name line, then the email muted. Without
// a name only the email; without both a dash.
export function MailRecipient({name, email}: {name: string; email: string}) {
    if (!name && !email) return <span className="event-manage-table__dim">—</span>;
    if (!name) return <>{email}</>;
    return <span className="event-manage-table__person"><strong>{name}</strong>{email && <small>{email}</small>}</span>;
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
