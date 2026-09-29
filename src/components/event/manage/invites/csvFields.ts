// Form-field columns of the CSV import: the columns come from the event's
// CURRENT forms (participant fields, and team fields in team mode). A header
// cell is the field code, with a «*» suffix when the field is required
// (the parser ignores the suffix). Every value is checked against the field
// type; a blank cell is «not given» — required fields left blank are only
// reported (the person fills them in on first login), they never block.

import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswer, ParticipantAnswers} from "@/api/participantForm";
import {visibleFieldKeys} from "@/components/event/formVisibility";
import {dateModeOf, isFormField, parseDateAnswer} from "@/components/event/manage/participantFormEditor";
import {t} from "@/i18n/t";

export type FieldScope = "team" | "participant";
export type FieldColumn = {code: string; scope: FieldScope; field: FormField; required: boolean};
export type CsvSchema = {
    team: FieldColumn[];
    participant: FieldColumn[];
    teamForm: ParticipantForm | null;
    participantForm: ParticipantForm | null;
    // «Файл» questions cannot be imported: people upload them themselves.
    skipped: Array<{scope: FieldScope; field: FormField}>;
};
export type FieldIssue = {code: "invalidNumber" | "invalidOption" | "invalidChoice" | "invalidBool" | "invalidDate" | "dateRange"; column: string; value: string};

export const emptySchema: CsvSchema = {team: [], participant: [], teamForm: null, participantForm: null, skipped: []};

// Yes/no marks, matched against uploaded files (data tokens, not UI text).
// eslint-disable-next-line no-restricted-syntax -- CSV checkbox marks matched against uploaded files, not UI text
const yesMarks = new Set(["так", "yes", "true", "1", "+", "x", "х"]);
// eslint-disable-next-line no-restricted-syntax -- CSV checkbox marks matched against uploaded files, not UI text
const noMarks = new Set(["ні", "no", "false", "0", "-"]);

function isStaffOnly(field: FormField): boolean {
    return (field as {staffOnly?: boolean}).staffOnly === true;
}

// A field is required for the person when the whole form is required, the
// field is marked, and it is not a staff-only field (organizers fill those).
function isRequired(form: ParticipantForm, field: FormField): boolean {
    return form.Required && !!field.required && !isStaffOnly(field);
}

function columnsOf(form: ParticipantForm | null, scope: FieldScope, taken: Set<string>, skipped: CsvSchema["skipped"]): FieldColumn[] {
    if (!form?.Enabled) return [];
    const columns: FieldColumn[] = [];
    for (const block of form.Document.blocks) {
        if (!isFormField(block)) continue;
        if (block.input === "file") {skipped.push({scope, field: block}); continue;}
        // A code that is already a column (a base column, or the other form's
        // field) gets the scope as a prefix.
        let code = block.key;
        for (let attempt = 0; taken.has(code.toLowerCase()); attempt++) code = attempt === 0 ? `${scope}_${block.key}` : `${scope}_${block.key}_${attempt + 1}`;
        taken.add(code.toLowerCase());
        columns.push({code, scope, field: block, required: isRequired(form, block)});
    }
    return columns;
}

// baseColumns are the fixed columns of the file; team is null in invite mode
// (and for individual events), which then has no team columns at all.
export function buildSchema(participantForm: ParticipantForm | null | undefined, teamForm: ParticipantForm | null | undefined, baseColumns: readonly string[]): CsvSchema {
    const taken = new Set(baseColumns.map(column => column.toLowerCase()));
    const skipped: CsvSchema["skipped"] = [];
    const team = columnsOf(teamForm ?? null, "team", taken, skipped);
    const participant = columnsOf(participantForm ?? null, "participant", taken, skipped);
    return {team, participant, teamForm: teamForm ?? null, participantForm: participantForm ?? null, skipped};
}

export function headerCell(column: FieldColumn): string {
    return column.required ? `${column.code}*` : column.code;
}

// The template header: team, team fields, then the person columns, then the
// participant fields.
export function templateHeader(schema: CsvSchema, mode: "invite" | "team"): string[] {
    return mode === "team"
        ? ["team", ...schema.team.map(headerCell), "email", "first_name", "last_name", "captain", ...schema.participant.map(headerCell)]
        : ["email", "first_name", "last_name", ...schema.participant.map(headerCell)];
}

function pad(value: number): string { return String(value).padStart(2, "0"); }

// An example value in the format the parser wants, one per field type.
export function exampleValue(field: FormField): string {
    switch (field.input) {
        case "number": return "42";
        case "select": return field.options?.[0] ?? "";
        case "multi_select": return (field.options ?? []).slice(0, 2).join("|");
        case "checkbox": return t("manage.invites.template.yes");
        case "date": {
            const mode = dateModeOf(field);
            return mode === "time" ? "14:30" : mode === "datetime" ? "2026-10-15T14:30:00Z" : "2026-10-15";
        }
        default: return t(field.input === "long_text" ? "manage.invites.template.longText" : "manage.invites.template.text");
    }
}

export function exampleRow(columns: FieldColumn[], filled: boolean): string[] {
    return columns.map(column => filled ? exampleValue(column.field) : "");
}

export function isNo(raw: string): boolean {
    return noMarks.has(raw.trim().toLowerCase());
}

export function isYes(raw: string): boolean {
    return yesMarks.has(raw.trim().toLowerCase());
}

function normalizeDate(field: FormField, raw: string): string | null {
    const mode = dateModeOf(field);
    const value = raw.trim();
    if (mode === "time") {
        const match = /^(\d{1,2}):(\d{2})$/.exec(value);
        return match ? `${pad(Number(match[1]))}:${match[2]}` : null;
    }
    // Excel's uk locale writes a day as DD.MM.YYYY.
    const day = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(.*)$/.exec(value);
    const text = day ? `${day[3]}-${pad(Number(day[2]))}-${pad(Number(day[1]))}${day[4]}` : value;
    if (mode === "date") return text;
    // A datetime is UTC: «YYYY-MM-DD HH:MM», «…THH:MM», «…THH:MM:SSZ».
    const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?Z?$/.exec(text);
    return match ? `${match[1]}T${pad(Number(match[2]))}:${match[3]}:${match[4] ?? "00"}Z` : null;
}

// Parses one cell. undefined means «not given» (blank). A bad value is an issue.
export function parseFieldCell(column: FieldColumn, raw: string): {value?: ParticipantAnswer; issue?: FieldIssue} {
    const text = raw.trim();
    if (!text) return {};
    const {field, code} = column;
    const bad = (issue: FieldIssue["code"]) => ({issue: {code: issue, column: code, value: raw} as FieldIssue});
    switch (field.input) {
        case "number": {
            const value = Number(text.replace(",", "."));
            return /^-?\d+([.,]\d+)?$/.test(text) && Number.isFinite(value) ? {value} : bad("invalidNumber");
        }
        case "checkbox":
            return isYes(text) ? {value: true} : isNo(text) ? {value: false} : bad("invalidBool");
        case "select": {
            const option = field.options?.find(item => item.toLowerCase() === text.toLowerCase());
            return option === undefined ? bad("invalidOption") : {value: option};
        }
        case "multi_select": {
            const values: string[] = [];
            for (const part of text.split("|").map(item => item.trim()).filter(Boolean)) {
                const option = field.options?.find(item => item.toLowerCase() === part.toLowerCase());
                if (option === undefined) return bad("invalidChoice");
                if (!values.includes(option)) values.push(option);
            }
            return values.length ? {value: values} : {};
        }
        case "date": {
            const mode = dateModeOf(field);
            const value = normalizeDate(field, text);
            const at = value === null ? null : parseDateAnswer(mode, value);
            if (value === null || at === null) return bad("invalidDate");
            const min = field.minDate ? parseDateAnswer(mode, field.minDate) : null;
            const max = field.maxDate ? parseDateAnswer(mode, field.maxDate) : null;
            return (min !== null && at < min) || (max !== null && at > max) ? bad("dateRange") : {value};
        }
        default:
            return {value: text};
    }
}

export function parseFieldCells(columns: FieldColumn[], get: (code: string) => string): {values: ParticipantAnswers; issues: FieldIssue[]} {
    const values: ParticipantAnswers = {};
    const issues: FieldIssue[] = [];
    for (const column of columns) {
        const parsed = parseFieldCell(column, get(column.code));
        if (parsed.issue) issues.push(parsed.issue);
        else if (parsed.value !== undefined) values[column.field.key] = parsed.value;
    }
    return {values, issues};
}

// Labels of the required questions the person still has to answer: shown for
// the given answers (a condition can hide a question), required, and blank.
// Required files are always missing — they cannot be imported.
export function missingRequired(form: ParticipantForm | null, values: ParticipantAnswers): string[] {
    if (!form?.Enabled || !form.Required) return [];
    const shown = visibleFieldKeys(form.Document.blocks, values);
    return form.Document.blocks.filter(isFormField)
        .filter(field => isRequired(form, field) && shown.has(field.key) && (values[field.key] === undefined || values[field.key] === ""))
        .map(field => field.label);
}

// Help lines under the (?) of the CSV field: what each field column takes.
export function fieldHelp(schema: CsvSchema): string[] {
    const line = (column: FieldColumn) => {
        const kind = column.field.input === "date" ? t(`manage.invites.csv.kind.date.${dateModeOf(column.field)}`) : t(`manage.invites.csv.kind.${column.field.input}`, {options: (column.field.options ?? []).join(", ")});
        return `• ${column.required ? t("manage.invites.csv.columnRequired", {column: column.code}) : column.code} — ${column.field.label}: ${kind}`;
    };
    const lines = [...schema.team, ...schema.participant].map(line);
    if (schema.skipped.length) lines.push(t("manage.invites.csv.skippedFiles", {fields: schema.skipped.map(item => item.field.label).join(", ")}));
    return lines;
}
