"use client";

import {useEffect, useRef, useState, type FormEvent} from "react";
import {DialogModal} from "@/components/event/DialogModal";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {groupNameMax, groupNameProblem} from "./groupName";

// Create or rename a group: one required name field. Enter submits, Esc
// closes, the field gets focus on open.
export function GroupNameDialog({open, mode, initialName, otherNames, busy, onClose, onSubmit}: {
    open: boolean; mode: "create" | "rename"; initialName: string; otherNames: string[]; busy: boolean;
    onClose: () => void; onSubmit: (name: string) => void;
}) {
    const [name, setName] = useState(initialName);
    const [touched, setTouched] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const problem = groupNameProblem(name, otherNames);

    useEffect(() => {
        if (!open) return;
        // After showModal() moves focus into the dialog.
        const timer = window.setTimeout(() => input.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, [open]);

    function submit(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        setTouched(true);
        if (problem || busy) return;
        onSubmit(name.trim());
    }

    const shownProblem = touched || name !== initialName ? problem : "";
    return <DialogModal open={open} onClose={() => { if (!busy) onClose(); }} title={t(mode === "create" ? "manage.challenges.groups.createTitle" : "manage.challenges.groups.renameTitle")}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={onClose}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="submit" form="group-name-form" disabled={busy} busy={busy}>{t(mode === "create" ? "manage.challenges.groups.create" : "common.save")}</EventButton></>}>
        <form id="group-name-form" className="event-manage-field" onSubmit={submit} noValidate>
            <ManageFieldLabel htmlFor="group-name" title={t("manage.challenges.groups.name")} help={t("manage.challenges.groups.nameHelp")} required />
            <input ref={input} id="group-name" className="event-manage-input" value={name} maxLength={groupNameMax} required placeholder={t("manage.exercises.groups.newGroupPlaceholder")}
                aria-invalid={!!shownProblem} aria-describedby={shownProblem ? "group-name-error" : undefined}
                onChange={changeEvent => setName(changeEvent.target.value)} disabled={busy} />
            {shownProblem && <p className="event-manage-validation" id="group-name-error" role="alert">{shownProblem}</p>}
        </form>
    </DialogModal>;
}
