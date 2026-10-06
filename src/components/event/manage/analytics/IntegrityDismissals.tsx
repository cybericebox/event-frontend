"use client";

import {useId, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {ApiErrorCode, apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {
    dismissIntegrityPattern, getIntegrityDismissals, maxReviewNoteLength, removeIntegrityDismissal,
    type DismissScope, type IntegrityDismissal, type IntegrityItem, type IntegrityKind,
} from "@/api/manageAnalyticsIntegrity";
import {ManageTable, type ManageTableState} from "@/components/event/manage/ManageTable";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {t} from "@/i18n/t";
import {formatDateTime} from "./analyticsFormat";
import {integrityDismissalsKey, integrityFlagsKey, integrityKey, kindLabel} from "./integrityModel";
import {zoneOffset} from "@/utils/dateTime";

// «Виключення»: patterns the organizers asked not to highlight (docs/ANTI-CHEAT.md).
// A dismissal is for this event or for every event using the catalog exercise.

const knownErrors: number[] = [ApiErrorCode.EventAnalyticsSolveNotFound, ApiErrorCode.EventAnalyticsReviewNoteTooLong, ApiErrorCode.EventAnalyticsPatternNotDismissible];

export function integrityErrorMessage(error: unknown, fallback: string): string {
    return error instanceof ManageApiError && error.code !== undefined && knownErrors.includes(error.code) ? apiErrorMessage(error.code, fallback) : fallback;
}

export type DismissDraft = {item: IntegrityItem; kind: IntegrityKind; keyValue: string; scope: DismissScope; note: string; busy: boolean; error: string | null};

export function DismissDialog({draft, onChange, onClose, onDone}: {draft: DismissDraft | null; onChange: (patch: Partial<DismissDraft>) => void; onClose: () => void; onDone: () => void}) {
    const {event} = useManager();
    const queryClient = useQueryClient();
    const id = useId();
    const answer = draft?.kind === "shared_wrong";

    async function confirm() {
        if (!draft || draft.busy) return;
        const current = draft;
        onChange({busy: true, error: null});
        try {
            await dismissIntegrityPattern(event.EventID, {TeamChallengeID: current.item.TeamChallengeID, Kind: current.kind, Key: current.keyValue, Scope: current.scope, Note: current.note.trim()});
            await Promise.all([
                queryClient.invalidateQueries({queryKey: integrityKey(event.EventID)}),
                queryClient.invalidateQueries({queryKey: integrityFlagsKey(event.EventID)}),
                queryClient.invalidateQueries({queryKey: integrityDismissalsKey(event.EventID)}),
            ]);
            onDone();
            toast.success(t("manage.analytics.integrity.dismiss.done"));
        } catch (error) {
            onChange({busy: false, error: integrityErrorMessage(error, t("manage.analytics.integrity.dismiss.failed"))});
        }
    }

    return <ConfirmDialog open={!!draft} onCancel={onClose} busy={draft?.busy ?? false} error={draft?.error}
        title={t(answer ? "manage.analytics.integrity.dismiss.answerTitle" : "manage.analytics.integrity.dismiss.title")}
        description={draft ? answer ? t("manage.analytics.integrity.dismiss.answerDescription") : t("manage.analytics.integrity.dismiss.description", {kind: kindLabel(draft.kind)}) : undefined}
        subject={draft?.item.ChallengeName} confirmLabel={t("manage.analytics.integrity.dismiss.confirm")} onConfirm={() => void confirm()}>
        {draft && <>
            {answer && <p><code className="event-integrity__value">{draft.keyValue}</code></p>}
            <fieldset className="event-integrity__scope" disabled={draft.busy}>
                <legend>{t("manage.analytics.integrity.dismiss.scope")}</legend>
                {(["event", "exercise"] as const).map(scope => <label key={scope} className="event-integrity__scope-option">
                    <input type="radio" name={`${id}-scope`} value={scope} checked={draft.scope === scope} onChange={() => onChange({scope})} />
                    <span><strong>{t(`manage.analytics.integrity.dismiss.scope.${scope}`)}</strong>{scope === "exercise" && <small>{t("manage.analytics.integrity.dismiss.scope.exerciseHelp")}</small>}</span>
                </label>)}
            </fieldset>
            <div className="event-manage-field">
                <label htmlFor={`${id}-note`}>{t("manage.analytics.integrity.review.note")}</label>
                <textarea id={`${id}-note`} className="event-manage-input" value={draft.note} maxLength={maxReviewNoteLength} disabled={draft.busy}
                    placeholder={t("manage.analytics.integrity.dismiss.notePlaceholder")} onChange={event => onChange({note: event.target.value, error: null})} />
                <small className="event-integrity__counter">{t("manage.analytics.integrity.review.counter", {count: draft.note.length, max: maxReviewNoteLength})}</small>
            </div>
        </>}
    </ConfirmDialog>;
}

export function DismissalsPanel() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const [removing, setRemoving] = useState<{item: IntegrityDismissal; busy: boolean; error: string | null} | null>(null);
    const query = useQuery({queryKey: integrityDismissalsKey(eventID), queryFn: () => getIntegrityDismissals(eventID), refetchOnWindowFocus: false, placeholderData: previous => previous});
    const items = query.data ?? [];
    const state: ManageTableState = query.isPending && !query.data ? "loading" : query.isError && !query.data ? "error" : items.length === 0 ? "empty" : "ready";

    async function remove() {
        if (!removing || removing.busy) return;
        const current = removing;
        setRemoving({...current, busy: true, error: null});
        try {
            await removeIntegrityDismissal(eventID, current.item.ID);
            await Promise.all([
                queryClient.invalidateQueries({queryKey: integrityDismissalsKey(eventID)}),
                queryClient.invalidateQueries({queryKey: integrityKey(eventID)}),
                queryClient.invalidateQueries({queryKey: integrityFlagsKey(eventID)}),
            ]);
            setRemoving(null);
            toast.success(t("manage.analytics.integrity.dismissals.removed"));
        } catch {
            setRemoving({...current, busy: false, error: t("manage.analytics.integrity.dismissals.removeFailed")});
        }
    }

    return <>
        <p className="event-integrity__notice">{t("manage.analytics.integrity.dismissals.notice")}</p>
        <ManageTable event={event} state={state} loadingLabel={t("manage.analytics.integrity.dismissals.loading")} errorMessage={t("manage.analytics.integrity.dismissals.loadFailed")}
            emptyMessage={t("manage.analytics.integrity.dismissals.empty")} onRetry={() => void query.refetch()} error={query.error}
            head={<tr>
                <th scope="col">{t("manage.analytics.integrity.dismissals.col.kind")}</th>
                <th scope="col">{t("manage.analytics.integrity.dismissals.col.value")}</th>
                <th scope="col">{t("manage.analytics.integrity.dismissals.col.task")}</th>
                <th scope="col">{t("manage.analytics.integrity.dismissals.col.scope")}</th>
                <th scope="col">{t("manage.analytics.integrity.dismissals.col.author")}</th>
                <th scope="col">{t("manage.analytics.integrity.dismissals.col.date", {zone: zoneOffset()})}</th>
                <th scope="col">{t("manage.analytics.integrity.dismissals.col.note")}</th>
                <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.analytics.integrity.col.actions")}</span></th>
            </tr>}>
            <tbody>{items.map(item => <tr key={item.ID}>
                <td>{kindLabel(item.Kind)}</td>
                <td>{item.Key ? <code className="event-integrity__value">{item.Key}</code> : <span className="event-manage-table__dim">{t("manage.analytics.integrity.dismissals.noValue")}</span>}</td>
                <td>{item.ChallengeName}</td>
                <td><span className="ib-tag ib-tag--sm">{t(`manage.analytics.integrity.dismiss.scope.${item.Scope}`)}</span></td>
                <td>{item.CreatedBy}</td>
                <td className="event-manage-table__nowrap">{formatDateTime(item.CreatedAt)}</td>
                <td className="event-integrity__note">{item.Note}</td>
                <td className="event-manage-table__actions-col">{canManage && <button className="ib-btn ib-btn--sm" type="button" onClick={() => setRemoving({item, busy: false, error: null})}>{t("manage.analytics.integrity.dismissals.remove")}</button>}</td>
            </tr>)}</tbody>
        </ManageTable>
        <ConfirmDialog open={!!removing} onCancel={() => setRemoving(null)} tone="danger" busy={removing?.busy ?? false} error={removing?.error}
            title={t("manage.analytics.integrity.dismissals.removeTitle")} description={t("manage.analytics.integrity.dismissals.removeDescription")}
            subject={removing ? removing.item.ChallengeName : undefined} confirmLabel={t("manage.analytics.integrity.dismissals.remove")} onConfirm={() => void remove()} />
    </>;
}
