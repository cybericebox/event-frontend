"use client";

import {useId, useState} from "react";
import {Copy, Pencil, Plus, Trash2} from "lucide-react";
import {createLiveScreen, deleteLiveScreen, duplicateLiveScreen, renameLiveScreen, type LiveScreenSummary} from "@/api/manageLive";
import {DialogModal} from "@/components/event/DialogModal";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {failureText} from "@/components/ui/toastApiError";
import {t} from "@/i18n/t";

export const liveScreenNameMax = 40;

// «Екран»: the screens of the event in one select (up to 10), and the actions
// on the open one. Every screen is edited with the same editor; switching
// saves the open screen first (onSwitch waits for that).
export function LiveScreenPicker({eventID, screens, max, currentID, disabled, onSwitch, onChanged}: {
    eventID: string; screens: LiveScreenSummary[]; max: number; currentID: string; disabled: boolean;
    onSwitch: (screenID: string) => void;
    // The list changed; `select` is the screen to open next (a new or the remaining one).
    onChanged: (select?: string) => void;
}) {
    const current = screens.find(screen => screen.ID === currentID) ?? screens[0];
    const [busy, setBusy] = useState<"create" | "duplicate" | "rename" | "delete" | null>(null);
    const [renaming, setRenaming] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");
    const nameID = useId();
    const full = screens.length >= max;
    const name = renaming ?? "";
    const nameError = renaming !== null && !name.trim() ? t("manage.live.screens.nameMissing") : null;

    async function run(kind: NonNullable<typeof busy>, action: () => Promise<string | undefined>, done?: () => void) {
        setBusy(kind); setError("");
        try {
            const select = await action();
            done?.();
            onChanged(select);
        } catch (failure) {setError(failureText(failure, t("manage.live.screens.error")));}
        finally {setBusy(null);}
    }

    return <div className="event-live-screens">
        <span className="event-live-screens__label" id={`${nameID}-label`}>{t("manage.live.screens.label")}</span>
        <EventSelect ariaLabel={t("manage.live.screens.label")} value={current?.ID ?? ""} disabled={busy !== null}
            options={screens.map(screen => ({value: screen.ID, label: screen.Name}))} onValueChange={value => {if (value !== currentID) onSwitch(value);}} />
        {!disabled && <>
            <EventTooltip content={t("manage.live.screens.rename")}>{id => <button className="ib-btn ib-btn--ghost event-live-editor__icon" type="button" aria-label={t("manage.live.screens.rename")} aria-describedby={id}
                disabled={busy !== null} onClick={() => {setError(""); setRenaming(current?.Name ?? "");}}><Pencil size={16} /></button>}</EventTooltip>
            <EventButton className="ib-btn ib-btn--sm" busy={busy === "duplicate"} busyLabel={t("manage.live.screens.duplicating")} disabled={full || busy !== null}
                title={full ? t("manage.live.screens.full", {max}) : undefined}
                onClick={() => void run("duplicate", async () => (await duplicateLiveScreen(eventID, currentID)).ID)}><Copy size={16} /> {t("manage.live.screens.duplicate")}</EventButton>
            <EventButton className="ib-btn ib-btn--sm" busy={busy === "create"} busyLabel={t("manage.live.screens.creating")} disabled={full || busy !== null}
                title={full ? t("manage.live.screens.full", {max}) : undefined}
                onClick={() => void run("create", async () => (await createLiveScreen(eventID)).ID)}><Plus size={16} /> {t("manage.live.screens.create")}</EventButton>
            {screens.length > 1 && <EventTooltip content={t("manage.live.screens.delete")}>{id => <button className="ib-btn ib-btn--ghost event-live-editor__icon" type="button" aria-label={t("manage.live.screens.delete")} aria-describedby={id}
                disabled={busy !== null} onClick={() => {setError(""); setDeleting(true);}}><Trash2 size={16} /></button>}</EventTooltip>}
        </>}
        {error && !deleting && renaming === null && <small className="event-manage-validation" role="alert">{error}</small>}
        <DialogModal open={renaming !== null} onClose={() => setRenaming(null)} size="sm" title={t("manage.live.screens.renameTitle")}
            footer={<>
                <button className="ib-btn" type="button" onClick={() => setRenaming(null)}>{t("common.cancel")}</button>
                <EventButton className="ib-btn ib-btn--primary" busy={busy === "rename"} busyLabel={t("manage.live.screens.renaming")} disabled={!!nameError}
                    onClick={() => void run("rename", async () => {await renameLiveScreen(eventID, currentID, name.trim()); return undefined;}, () => setRenaming(null))}>{t("manage.live.screens.renameSave")}</EventButton>
            </>}>
            <div className="event-live-field">
                <label className="event-live-field__label" htmlFor={nameID}>{t("manage.live.screens.name")}</label>
                <input id={nameID} className="event-manage-input" value={name} maxLength={liveScreenNameMax} autoFocus
                    aria-invalid={!!nameError || undefined} aria-describedby={nameError ? `${nameID}-error` : undefined} onChange={change => setRenaming(change.target.value)} />
                {nameError && <small id={`${nameID}-error`} className="event-manage-validation" role="alert">{nameError}</small>}
                {error && <small className="event-manage-validation" role="alert">{error}</small>}
            </div>
        </DialogModal>
        <ConfirmDialog open={deleting} onCancel={() => setDeleting(false)} tone="danger" title={t("manage.live.screens.deleteTitle")} subject={current?.Name}
            description={t("manage.live.screens.deleteBody")} confirmLabel={t("manage.live.screens.deleteConfirm")} busyLabel={t("common.busy.removing")} busy={busy === "delete"} error={deleting ? error : undefined}
            onConfirm={() => void run("delete", async () => {
                await deleteLiveScreen(eventID, currentID);
                return screens.find(screen => screen.ID !== currentID)?.ID;
            }, () => setDeleting(false))} />
    </div>;
}
