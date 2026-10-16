"use client";

import {useDraftDirty, useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useEffect, useLayoutEffect, useRef, useState, type FormEvent} from "react";
import {DialogModal} from "@/components/event/DialogModal";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {groupNameMax, groupNameProblem} from "./groupName";

// Create or rename a group: one required name field. Enter submits, Esc
// closes, the field gets focus on open.
export function GroupNameDialog({open, mode, initialName, draftID, otherNames, busy, onClose, onSubmit, error, onClearError}: {
    open: boolean; mode: "create" | "rename"; initialName: string; draftID?: string | number; otherNames: string[]; busy: boolean;
    error?: string; onClearError?: () => void;
    onClose: () => void; onSubmit: (name: string) => void | Promise<boolean | void>;
}) {
    const slot = `group-name-${mode}-${draftID ?? initialName}`;
    const [nameEdit, setName] = useSessionDraftState<string | null>(slot, null);
    const name = nameEdit ?? initialName;
    const [touched, setTouched] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const latestName = useRef(name);
    useLayoutEffect(() => {latestName.current = name;}, [name]);
    const dirty = mode === "create" || name.trim() !== initialName.trim();
    useDraftDirty(slot, name.trim() !== initialName.trim(), {preserveInput: true});
    const problem = groupNameProblem(name, otherNames);

    useEffect(() => {
        if (!open) return;
        // After showModal() moves focus into the dialog.
        const timer = window.setTimeout(() => input.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, [open]);

    async function submit(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        setTouched(true);
        if (problem || busy || !dirty) return;
        const saved = await onSubmit(name.trim());
        if (saved && latestName.current === name) {setName(null); onClose();}
    }

    const shownProblem = (touched || name !== initialName ? problem : "") || error;
    return <DialogModal open={open} onClose={() => { if (!busy) onClose(); }} title={t(mode === "create" ? "manage.challenges.groups.createTitle" : "manage.challenges.groups.renameTitle")}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={onClose}>{t("common.cancel")}</button>
            <EventButton saveDirty={dirty} className="ib-btn ib-btn--primary" type="submit" form="group-name-form" disabled={busy} busy={busy}>{t(mode === "create" ? "manage.challenges.groups.create" : "common.save")}</EventButton></>}>
        <form id="group-name-form" className="event-manage-field" onSubmit={submit} noValidate>
            <ManageFieldLabel htmlFor="group-name" title={t("manage.challenges.groups.name")} help={t("manage.challenges.groups.nameHelp")} required />
            <input ref={input} id="group-name" className="event-manage-input" value={name} maxLength={groupNameMax} required placeholder={t("manage.exercises.groups.newGroupPlaceholder")}
                aria-invalid={!!shownProblem} aria-describedby={shownProblem ? "group-name-error" : undefined}
                onChange={changeEvent => {setName(changeEvent.target.value); onClearError?.();}} disabled={busy && mode === "create"} />
            {shownProblem && <p className="event-manage-validation" id="group-name-error" role="alert">{shownProblem}</p>}
        </form>
    </DialogModal>;
}
