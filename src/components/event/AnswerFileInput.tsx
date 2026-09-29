"use client";

import {useState} from "react";
import {AnswerFileError, type AnswerFile} from "@/api/answerFiles";
import type {FileKind, FormField} from "@/api/manageParticipantForm";
import {apiErrorMessage} from "@/api/apiErrors";
import {EventFilePicker} from "@/components/ui/EventFilePicker";
import {defaultFileMB, maxFileMB} from "@/components/event/manage/participantFormEditor";
import {t} from "@/i18n/t";

const accepted: Record<FileKind, string> = {
    pdf: ".pdf,application/pdf",
    image: ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp",
    word: ".doc,.docx,.odt",
    excel: ".xls,.xlsx,.ods",
    powerpoint: ".ppt,.pptx,.odp",
    text: ".txt,.md,.csv,.rtf",
    archive: ".zip,.7z,.rar,.tar,.gz,.tgz",
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
    const [pending, setPending] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function choose(file: File | null) {
        setError(null);
        if (!file) {onChange(undefined); return;}
        setPending(file);
        try {onChange(await upload(file));}
        catch (failure) {setError(apiErrorMessage(failure instanceof AnswerFileError ? failure.code : undefined, t("forms.file.uploadFailed")));}
        finally {setPending(null);}
    }

    // The picker checks the format and the size of a picked or dropped file.
    return <EventFilePicker id={id} fileName={pending?.name ?? value?.name ?? null} fileSize={pending?.size ?? value?.size} busy={!!pending} error={error}
        accept={(field.fileTypes ?? []).map(kind => accepted[kind]).join(",")} maxBytes={fileLimitMB(field) * 1024 * 1024} hint={fileRulesText(field)}
        disabled={disabled} onFile={file => void choose(file)} />;
}
