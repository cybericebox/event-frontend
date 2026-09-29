import {t, tPlural} from "@/i18n/t";

// The import preview: who still has required questions to answer. It never
// blocks the import — those people fill them in on first login.
export function MissingFieldsSummary({rows}: {rows: Array<{name: string; missing: string[]}>}) {
    const gaps = rows.filter(row => row.missing.length > 0);
    if (gaps.length === 0) return null;
    return <div className="event-modal__gaps" role="status">
        <p className="event-modal__summary">{tPlural("manage.invites.csv.missing.summary", gaps.length)}</p>
        <ul className="event-modal__issues event-modal__issues--soft">
            {gaps.slice(0, 20).map(row => <li key={row.name}>{t("manage.invites.csv.missing.line", {name: row.name, fields: row.missing.join(", ")})}</li>)}
            {gaps.length > 20 && <li>{t("manage.invites.csv.more.people", {count: gaps.length - 20})}</li>}
        </ul>
    </div>;
}
