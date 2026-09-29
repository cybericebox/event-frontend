"use client";

import {useState} from "react";
import {apiErrorMessage} from "@/api/apiErrors";
import {EventTeamError} from "@/api/eventTeams";
import {ParticipantJoinError} from "@/api/participantForm";
import type {FormField} from "@/api/manageParticipantForm";
import {formatAnswer, joinCodeFromSearch, recalledJoinCode, rememberJoinCode} from "./participationModel";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {isFileAnswer, selfAnswerFileUrl} from "@/api/answerFiles";
import {formatDateAnswer} from "@/components/event/DateAnswerInput";
import {dateModeOf} from "@/components/event/manage/participantFormEditor";

// Pieces shared by «Мій профіль учасника» and «Моя команда».

export function errorText(error: unknown, fallback: string): string {
    if (error instanceof EventTeamError || error instanceof ParticipantJoinError) return apiErrorMessage(error.code, fallback);
    return fallback;
}

export type Confirm = {title: string; text: string; action: string; danger?: boolean; run: () => Promise<void>} | null;

export function TeamConfirm({confirm, onClose}: {confirm: Confirm; onClose: () => void}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    return <ConfirmDialog open={!!confirm} onCancel={() => {setError(""); onClose();}} tone={confirm?.danger ? "danger" : "default"} busy={busy} error={error}
        title={confirm?.title ?? ""} description={confirm?.text} confirmLabel={confirm?.action ?? ""} onConfirm={async () => {
            if (!confirm) return;
            setBusy(true);
            setError("");
            try { await confirm.run(); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : ""); } finally { setBusy(false); }
        }} />;
}

// A file answer downloads, a date reads in the viewer's words; the rest is text.
export function AnswerValue({field, value}: {field: FormField; value: unknown}) {
    if (isFileAnswer(value)) return <a className="ib-link" href={selfAnswerFileUrl(value.id)} download>{value.name}</a>;
    if (field.input === "date" && typeof value === "string" && value) return <>{formatDateAnswer(dateModeOf(field), value)}</>;
    return <>{formatAnswer(value)}</>;
}

// A join link is opened by a visitor who may still have to sign in or register: the code waits in the session.
export function useLinkCode(): string {
    const [code] = useState(() => {
        const fromLink = typeof window === "undefined" ? "" : joinCodeFromSearch(window.location.search);
        if (fromLink) rememberJoinCode(fromLink);
        return fromLink || recalledJoinCode();
    });
    return code;
}
