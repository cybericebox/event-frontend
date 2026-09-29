"use client";

import {useState} from "react";
import {AnswerFileError, type AnswerFile} from "@/api/answerFiles";
import type {FileKind, FormField} from "@/api/manageParticipantForm";
import {apiErrorMessage} from "@/api/apiErrors";
import {FilePicker} from "@/components/event/manage/invites/FilePicker";
import {defaultFileMB, maxFileMB} from "@/components/event/manage/participantFormEditor";
import {BusyMark} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import "./answerFile.css";

const accepted: Record<FileKind, string> = {
    pdf: ".pdf,application/pdf",
    image: ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp",
    doc: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    zip: ".zip,application/zip",
};

export function fileLimitMB(field: FormField): number {
    return Math.min(field.maxSizeMB ?? defaultFileMB, maxFileMB);
}

// «PDF, зображення · до 10 МБ» — what the question accepts.
export function fileRulesText(field: FormField): string {
    const kinds = (field.fileTypes ?? []).map(kind => t(`manage.fields.fileKind.${kind}`)).join(", ");
    return t("forms.file.rules", {kinds, max: fileLimitMB(field)});
}

// The answer to a «Файл» question: our file picker; the file uploads as soon
// as it is chosen and the answer keeps the server's reference to it.
export function AnswerFileInput({id, field, value, onChange, upload, disabled = false}: {
    id: string;
    field: FormField;
    value: AnswerFile | undefined;
    onChange: (value: AnswerFile | undefined) => void;
    upload: (file: File) => Promise<AnswerFile>;
    disabled?: boolean;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hintID = `${id}-rules`;

    async function choose(file: File | null) {
        setError(null);
        if (!file) {onChange(undefined); return;}
        if (file.size > fileLimitMB(field) * 1024 * 1024) {setError(t("forms.file.tooLarge", {max: fileLimitMB(field)})); return;}
        setBusy(true);
        try {onChange(await upload(file));}
        catch (failure) {setError(apiErrorMessage(failure instanceof AnswerFileError ? failure.code : undefined, t("forms.file.uploadFailed")));}
        finally {setBusy(false);}
    }

    return <div className="event-answer-file">
        <div className="event-answer-file__row">
            <FilePicker id={id} fileName={value?.name ?? null} accept={(field.fileTypes ?? []).map(kind => accepted[kind]).join(",")} disabled={disabled || busy} describedBy={hintID} onFile={file => void choose(file)} />
            {busy && <span className="event-answer-file__busy" role="status" aria-label={t("forms.file.uploading")}><BusyMark /></span>}
        </div>
        <small id={hintID}>{fileRulesText(field)}</small>
        {error && <p className="event-answer-file__error" role="alert">{error}</p>}
    </div>;
}
