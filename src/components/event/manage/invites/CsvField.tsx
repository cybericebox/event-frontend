"use client";

import {useId, type Ref} from "react";
import {t} from "@/i18n/t";
import {EventFilePicker, type FilePickerHandle} from "@/components/ui/EventFilePicker";
import {HelpTooltip} from "./HelpTooltip";
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
export function CsvField({label, columns, required, examples, templateName, fileName, onFile, issues, disabled = false, pickerRef}: {
    label: string;
    columns: readonly string[];
    required: readonly string[];
    examples: ReadonlyArray<readonly string[]>;
    templateName: string;
    fileName: string | null;
    onFile: (file: File | null) => void;
    issues: CsvIssue[];
    disabled?: boolean;
    // The dialog's whole-body drop passes files through the picker's checks.
    pickerRef?: Ref<FilePickerHandle>;
}) {
    const id = useId();
    const help = [t("manage.invites.csv.columnsIntro"), ...columns.map(column => `• ${required.includes(column) ? t("manage.invites.csv.columnRequired", {column}) : column}`), t("manage.invites.csv.columnsNote")].join("\n");
    return <div className="ib-field">
        <span className="event-field-help"><label className="ib-field__label" htmlFor={id}>{label}</label><HelpTooltip label={t("manage.invites.csv.columnsLabel")} text={help} /></span>
        <div className="event-csv-row">
            <EventFilePicker id={id} pickerRef={pickerRef} compact fileName={fileName} onFile={onFile} accept=".csv,text/csv" hint={t("manage.invites.csv.fileHint")} disabled={disabled} describedBy={issues.length ? `${id}-issues` : undefined} />
            <button className="ib-link ib-link--standalone event-csv-template" type="button" onClick={() => download(templateName, csvTemplate(columns, examples))}>{t("manage.invites.csv.template")}</button>
        </div>
        {issues.length > 0 && <ul className="event-modal__issues" id={`${id}-issues`} role="alert">{issues.slice(0, 50).map((issue, index) => <li key={index}>{csvIssueText(issue)}</li>)}{issues.length > 50 && <li>{t("manage.invites.csv.more", {count: issues.length - 50})}</li>}</ul>}
    </div>;
}
