import type {FormField} from "@/api/manageParticipantForm";
import {formatAnswer} from "./listColumns";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";

// Every configured field in form order, then answers to fields that are no
// longer in the form (kept by the backend for earlier registrations).
export function AnswersList({fields, answers}: {fields: FormField[]; answers: Record<string, unknown>}) {
    const known = new Set(fields.map(field => field.key));
    const extra = Object.entries(answers).filter(([key]) => !known.has(key));
    if (fields.length === 0 && extra.length === 0) return <EmptyState compact message={t("manage.fields.noAnswers")} />;
    return <dl className="event-form-responses__answers">
        {fields.map(field => <div key={field.key}><dt>{field.label || field.key}</dt><dd>{formatAnswer(answers[field.key])}</dd></div>)}
        {extra.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{formatAnswer(value)}</dd></div>)}
    </dl>;
}
