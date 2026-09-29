"use client";

import {useId} from "react";
import {CircleHelp} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {EventFilePicker} from "@/components/ui/EventFilePicker";
import {csvTemplate, type CsvIssue} from "./inviteCsv";
import "./invites.css";

export function csvIssueText(issue: CsvIssue): string {
    const message = t(`manage.invites.csv.issue.${issue.code}`, {column: issue.column ?? "", value: issue.value ?? ""});
    return t("manage.invites.csv.row", {row: issue.row, message});
}

function download(fileName: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], {type: "text/csv;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

// CSV upload field: a (?) tooltip lists the columns, «Завантажити шаблон»
// downloads a template, and the parse issues are listed with file rows.
export function CsvField({label, columns, required, example, templateName, fileName, onFile, issues, disabled = false}: {
    label: string;
    columns: readonly string[];
    required: readonly string[];
    example: readonly string[];
    templateName: string;
    fileName: string | null;
    onFile: (file: File | null) => void;
    issues: CsvIssue[];
    disabled?: boolean;
}) {
    const id = useId();
    const help = [t("manage.invites.csv.columnsIntro"), ...columns.map(column => `• ${required.includes(column) ? t("manage.invites.csv.columnRequired", {column}) : column}`), t("manage.invites.csv.columnsNote")].join("\n");
    return <div className="ib-field">
        <div className="ib-field__row">
            <span className="event-field-help"><label className="ib-field__label" htmlFor={id}>{label}</label>
                <EventTooltip content={help}>{tipID => <button className="event-brand-help" type="button" aria-label={t("manage.invites.csv.columnsLabel")} aria-describedby={tipID}><CircleHelp size={15} /></button>}</EventTooltip></span>
            <button className="ib-link ib-field__aside" type="button" onClick={() => download(templateName, csvTemplate(columns, example))}>{t("manage.invites.csv.template")}</button>
        </div>
        <EventFilePicker id={id} fileName={fileName} onFile={onFile} accept=".csv,text/csv" disabled={disabled} describedBy={issues.length ? `${id}-issues` : undefined} />
        {issues.length > 0 && <ul className="event-modal__issues" id={`${id}-issues`} role="alert">{issues.slice(0, 50).map((issue, index) => <li key={index}>{csvIssueText(issue)}</li>)}{issues.length > 50 && <li>{t("manage.invites.csv.more", {count: issues.length - 50})}</li>}</ul>}
    </div>;
}
