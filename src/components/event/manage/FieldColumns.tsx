import {isFileAnswer, manageAnswerFileUrl} from "@/api/answerFiles";
import type {FormField} from "@/api/manageParticipantForm";
import {formatAnswer} from "./listColumns";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";

// Every configured field in form order, then answers to fields that are no
// longer in the form (kept by the backend for earlier registrations).
// Staff-only fields have their own editable panel and are left out here.
export function AnswersList({fields, answers}: {fields: FormField[]; answers: Record<string, unknown>}) {
    const known = new Set(fields.map(field => field.key));
    const extra = Object.entries(answers).filter(([key]) => !known.has(key));
    const shown = fields.filter(field => !field.staffOnly);
    if (shown.length === 0 && extra.length === 0) return <EmptyState compact message={t("manage.fields.noAnswers")} />;
    return <dl className="event-form-responses__answers">
        {shown.map(field => <div key={field.key}><dt>{field.label || field.key}</dt><dd>{formatAnswer(answers[field.key])}</dd></div>)}
        {extra.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{formatAnswer(value)}</dd></div>)}
    </dl>;
}

const localDateTime = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});

// One answer in a table cell: a «Файл» answer is a staff download link.
export function AnswerValue({eventID, value}: {eventID: string; value: unknown}) {
    if (isFileAnswer(value)) return <a className="ib-link" href={manageAnswerFileUrl(eventID, value.id)} download onClick={event => event.stopPropagation()}>{value.name}</a>;
    // «Дата» with time is stored as UTC ISO; show it in the viewer's time.
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.+Z$/.test(value) && !Number.isNaN(Date.parse(value))) return <>{localDateTime.format(new Date(value))}</>;
    return <>{formatAnswer(value)}</>;
}
