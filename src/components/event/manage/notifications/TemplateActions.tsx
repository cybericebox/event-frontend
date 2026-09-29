"use client";

import {useState} from "react";
import {Pencil, RotateCcw} from "lucide-react";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {t} from "@/i18n/t";
import type {TemplateMode} from "./notificationModel";

// The state line of a template and its actions. A platform template is only
// shown; «Налаштувати для заходу» makes the event copy and opens its editor.
// A published copy is edited through a draft; «Повернути стандартний» deletes
// the event's versions and goes back to the platform template.
export function TemplateActions({mode, status, canManage, busy, onCustomize, onEdit, onRestore, onReset}: {
    mode: TemplateMode;
    status: string;
    canManage: boolean;
    busy: boolean;
    onCustomize: () => void;
    onEdit: () => void;
    onRestore: () => void;
    onReset: () => Promise<boolean>;
}) {
    const [confirming, setConfirming] = useState(false);
    const [resetting, setResetting] = useState(false);
    if (mode === "none") return null;

    async function confirm() {
        setResetting(true);
        const done = await onReset();
        setResetting(false);
        if (done) setConfirming(false);
    }

    return <div className="event-manage-notifications__state">
        <span>{mode === "platform" ? t("manage.notifications.platformTemplate") : status}</span>
        {canManage && <div className="event-manage-notifications__delivery-actions">
            {mode === "platform" && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={busy} onClick={onCustomize}>{t("manage.notifications.customize")}</button>}
            {mode === "view" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={onEdit}><Pencil size={15} /> {t("manage.notifications.edit")}</button>}
            {mode === "previous" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={onRestore}>{t("manage.notifications.restoreAsDraft")}</button>}
            {mode !== "platform" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setConfirming(true)}><RotateCcw size={15} /> {t("manage.notifications.restoreDefault")}</button>}
        </div>}
        <ConfirmDialog open={confirming} onCancel={() => setConfirming(false)} tone="danger" busy={resetting}
            title={t("manage.notifications.resetTemplateTitle")} description={t("manage.notifications.resetTemplateBody")}
            confirmLabel={t("manage.notifications.restoreDefault")} onConfirm={() => void confirm()} />
    </div>;
}
