"use client";

import {useState} from "react";
import {RotateCcw, Send} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";

export type DraftState = {
    // Local edits not yet saved as a draft.
    dirty: boolean;
    // A saved draft differs from the published version.
    hasDraft: boolean;
    // The page has been published at least once (the landing always is).
    published: boolean;
};

export function draftStateLabel({dirty, hasDraft, published}: DraftState): {title: string; detail: string} {
    if (dirty) return {title: "Є незбережені зміни", detail: "Збережіть чернетку або одразу опублікуйте."};
    if (!published) return {title: "Ще не опубліковано", detail: "Сторінку бачите лише ви в редакторі."};
    if (hasDraft) return {title: "Є неопубліковані зміни", detail: "На сайті — попередня версія. Попередній перегляд показує чернетку."};
    return {title: "Опубліковано", detail: "На сайті ця версія. Зміни з’являються протягом 5 хвилин."};
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
    return <div className="event-draft-bar" role="region" aria-label="Стан публікації">
        <div className="event-draft-bar__state" role="status"><strong>{label.title}</strong><small>{label.detail}</small></div>
        {canManage && <div className="event-draft-bar__actions">
            {state.dirty && <button className="ib-btn" type="button" disabled={!!busy} onClick={onRevertLocal}><RotateCcw size={16} /> Скасувати</button>}
            {!state.dirty && state.hasDraft && state.published && onDiscardDraft && <button className="ib-btn" type="button" disabled={!!busy} onClick={() => setConfirmDiscard(true)}><RotateCcw size={16} /> Скасувати зміни</button>}
            <button className="ib-btn" type="button" disabled={!state.dirty || invalid || !!busy} onClick={onSave}>{busy === "save" ? "Зберігаємо…" : "Зберегти"}</button>
            <button className="ib-btn ib-btn--primary" type="button" disabled={!canPublish || invalid || !!busy} onClick={onPublish}><Send size={16} /> {busy === "publish" ? "Публікуємо…" : "Опублікувати"}</button>
        </div>}
        <Dialog open={confirmDiscard} onOpenChange={open => {if (!busy) setConfirmDiscard(open);}}><DialogContent className="event-page-delete-dialog"><DialogHeader><DialogTitle>Скасувати неопубліковані зміни?</DialogTitle><DialogDescription>Чернетку буде видалено. У редакторі залишиться версія, яка зараз на сайті.</DialogDescription></DialogHeader><div className="event-page-delete-dialog__actions"><button className="ib-btn" type="button" disabled={!!busy} onClick={() => setConfirmDiscard(false)}>Залишити чернетку</button><button className="ib-btn ib-btn--danger-solid" type="button" disabled={!!busy} onClick={() => {onDiscardDraft?.(); setConfirmDiscard(false);}}>{busy === "discard" ? "Скасовуємо…" : "Скасувати зміни"}</button></div></DialogContent></Dialog>
    </div>;
}
