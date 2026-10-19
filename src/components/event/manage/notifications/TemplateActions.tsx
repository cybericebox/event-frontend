"use client";

import {useState} from "react";
import {Pencil, RotateCcw} from "lucide-react";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {t} from "@/i18n/t";
import type {TemplateMode} from "./notificationModel";

// The buttons of a template page for the current mode. A platform template is
// only shown; «Налаштувати для заходу» makes the event copy. A published copy
// is edited through a draft; «Повернути стандартний» deletes the event's
// versions and goes back to the platform template.
export function TemplateActions({mode, canManage, busy, onCustomize, onEdit, onRestore, onReset}: {
    mode: TemplateMode;
    canManage: boolean;
    busy: boolean;
    onCustomize: () => void;
    onEdit: () => void;
    onRestore: () => void;
    // Resolves to true when done, or to the error text, which stays inside the confirmation.
    onReset: () => Promise<true | string>;
}) {
    const [confirming, setConfirming] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [error, setError] = useState("");
    if (mode === "none" || !canManage) return null;

    async function confirm() {
        setResetting(true);
        setError("");
        const done = await onReset();
        setResetting(false);
        if (done === true) setConfirming(false);
        else setError(done);
    }

    return <>
        {mode === "platform" && <button className="ib-btn ib-btn--primary" type="button" disabled={busy} onClick={onCustomize}>{t("manage.notifications.customize")}</button>}
        {mode === "view" && <button className="ib-btn ib-btn--primary" type="button" disabled={busy} onClick={onEdit}><Pencil size={15} /> {t("manage.notifications.edit")}</button>}
        {mode === "previous" && <button className="ib-btn ib-btn--primary" type="button" disabled={busy} onClick={onRestore}>{t("manage.notifications.restoreAsDraft")}</button>}
        {mode !== "platform" && <button className="ib-btn" type="button" disabled={busy} onClick={() => {setError(""); setConfirming(true);}}><RotateCcw size={15} /> {t("manage.notifications.restoreDefault")}</button>}
        <ConfirmDialog open={confirming} onCancel={() => setConfirming(false)} tone="danger" busy={resetting} busyLabel={t("common.busy.resetting")} error={error || undefined}
            title={t("manage.notifications.resetTemplateTitle")} description={t("manage.notifications.resetTemplateBody")}
            confirmLabel={t("manage.notifications.restoreDefault")} onConfirm={() => void confirm()} />
    </>;
}
