"use client";

import {useState} from "react";
import {RotateCcw, Send} from "lucide-react";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";

export type DraftState = {
    // Local edits not yet saved as a draft.
    dirty: boolean;
    // A saved draft differs from the published version.
    hasDraft: boolean;
    // The page has been published at least once (the landing always is).
    published: boolean;
};

export function draftStateLabel({dirty, hasDraft, published}: DraftState): {title: string; detail: string} {
    if (dirty) return {title: t("manage.editor.draft.dirtyTitle"), detail: t("manage.editor.draft.dirtyDetail")};
    if (!published) return {title: t("manage.editor.draft.unpublishedTitle"), detail: t("manage.editor.draft.unpublishedDetail")};
    if (hasDraft) return {title: t("manage.editor.draft.draftTitle"), detail: t("manage.editor.draft.draftDetail")};
    return {title: t("manage.editor.draft.publishedTitle"), detail: t("manage.editor.draft.publishedDetail")};
}

/**
 * «Зберегти» stores a draft that is never public; «Опублікувати» saves pending
 * edits first and then publishes. «Скасувати зміни» drops the stored draft and
 * returns to the published version.
 */
export function DraftBar({state, busy, canManage, invalid, onSave, onPublish, onRevertLocal, onDiscardDraft}: {
    state: DraftState;
    busy: "save" | "publish" | "discard" | null;
    canManage: boolean;
    invalid: boolean;
    onSave: () => void;
    onPublish: () => void;
    onRevertLocal: () => void;
    onDiscardDraft?: () => void;
}) {
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const label = draftStateLabel(state);
    const canPublish = state.dirty || state.hasDraft || !state.published;
    return <div className="event-draft-bar" role="region" aria-label={t("manage.editor.draft.region")}>
        <div className="event-draft-bar__state" role="status"><strong>{label.title}</strong><small>{label.detail}</small></div>
        {canManage && <div className="event-draft-bar__actions">
            {state.dirty && <button className="ib-btn" type="button" disabled={!!busy} onClick={onRevertLocal}><RotateCcw size={16} /> {t("common.cancel")}</button>}
            {!state.dirty && state.hasDraft && state.published && onDiscardDraft && <button className="ib-btn" type="button" disabled={!!busy} onClick={() => setConfirmDiscard(true)}><RotateCcw size={16} /> {t("manage.editor.draft.discard")}</button>}
            <EventButton className="ib-btn" type="button" disabled={!state.dirty || invalid || !!busy} onClick={onSave} busy={busy === "save"}>{t("common.save")}</EventButton>
            <EventButton className="ib-btn ib-btn--primary" type="button" disabled={!canPublish || invalid || !!busy} onClick={onPublish} busy={busy === "publish"}><Send size={16} /> {t("manage.editor.draft.publish")}</EventButton>
        </div>}
        <ConfirmDialog open={confirmDiscard} onCancel={() => {if (!busy) setConfirmDiscard(false);}} tone="danger" busy={busy === "discard"} disabled={!!busy}
            title={t("manage.editor.draft.discardTitle")} description={t("manage.editor.draft.discardBody")}
            cancelLabel={t("manage.editor.draft.keep")} confirmLabel={t("manage.editor.draft.discard")} onConfirm={() => {onDiscardDraft?.(); setConfirmDiscard(false);}} />
    </div>;
}
