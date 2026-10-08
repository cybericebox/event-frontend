"use client";

import {useRef, useState, type FormEvent} from "react";
import {keepPreviousData, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError, type ManageLifecycle} from "@/api/manage";
import {
    createManageStage, deleteManageStage, getManageStages, updateManageStage, type ManageStage, type StageUpdateInput,
} from "@/api/manageStages";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {LabPolicyNumberField} from "./LabPolicyNumberField";
import {ManageDateField} from "@/components/event/manage/ManageDateField";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {t} from "@/i18n/t";
import {draftOfStage, isoOf, localDateTime, shortBreaks, stageDirty, stageLocks, type StageDraft} from "./stagesModel";
import "./stagesManage.css";

const stagesKey = (eventID: string) => ["event-management-stages", eventID];

// The server's reason for a refused stage change, else the caller's text.
const failureText = (failure: unknown, fallback: string) => failure instanceof ManageApiError ? apiErrorMessage(failure.code, fallback) : fallback;

const stateTag = (state: ManageStage["State"]) => <span className={`ib-tag ib-tag--sm${state === "open" ? " ib-tag--ok" : ""}`}>{t(`manage.stages.state.${state}`)}</span>;

function StageRow({eventID, stage, canManage, onPatch}: {
    eventID: string; stage: ManageStage; canManage: boolean; onPatch: (stage: ManageStage, patch: Partial<Pick<ManageStage, "Returnable" | "LabRetentionMinutes">>) => void;
}) {
    const queryClient = useQueryClient();
    const locks = stageLocks(stage);
    const [edit, setEdit] = useState<{stageID: string; value: StageDraft} | null>(null);
    const draft = edit?.stageID === stage.ID ? edit.value : draftOfStage(stage);
    const dirty = stageDirty(stage, draft);
    const [saving, setSaving] = useState(false);
    const [dialog, setDialog] = useState<"close" | "delete" | null>(null);
    const [busy, setBusy] = useState(false);
    const [dialogError, setDialogError] = useState("");

    const apply = (saved: ManageStage) => queryClient.setQueryData<ManageStage[]>(stagesKey(eventID), current => (current ?? []).map(item => item.ID === saved.ID ? saved : item));
    const refresh = () => queryClient.invalidateQueries({queryKey: stagesKey(eventID), exact: true});

    async function save(submitEvent: FormEvent) {
        submitEvent.preventDefault();
        if (!canManage || !dirty || saving) return;
        const input: StageUpdateInput = {Name: draft.Name};
        if (!locks.opens) input.OpensAt = isoOf(draft.OpensAt) ?? undefined;
        if (!locks.closes) input.ClosesAt = isoOf(draft.ClosesAt) ?? undefined;
        setSaving(true);
        try {
            apply(await updateManageStage(eventID, stage.ID, input));
            // Another stage may have moved with it (the neighbours keep to the order): reread them all.
            void refresh();
            setEdit(null);
            toast.success(t("manage.stages.saved"));
        } catch (failure) {toast.error(failureText(failure, t("manage.stages.saveFailed")));}
        finally {setSaving(false);}
    }

    async function confirm() {
        if (!dialog || busy) return;
        setBusy(true);
        setDialogError("");
        try {
            if (dialog === "close") {
                apply(await updateManageStage(eventID, stage.ID, {CloseNow: true}));
                toast.success(t("manage.stages.closedNow"));
            } else {
                await deleteManageStage(eventID, stage.ID);
                toast.success(t("manage.stages.deleted"));
            }
            setDialog(null);
            void refresh();
            void queryClient.invalidateQueries({queryKey: ["event-exercise-attachments", eventID]});
        } catch (failure) {setDialogError(failureText(failure, t("manage.stages.saveFailed")));}
        finally {setBusy(false);}
    }

    const disabled = !canManage;
    return <li className={`event-stage is-${stage.State}`} aria-label={t("manage.stages.rowAria", {name: stage.Name})}>
        <form className="event-stage__form" onSubmit={save}>
            <div className="event-stage__head">
                <div className="event-manage-field event-stage__name"><ManageFieldLabel htmlFor={`stage-name-${stage.ID}`} title={t("manage.stages.name")} help={t("manage.stages.help")} required />
                    <input id={`stage-name-${stage.ID}`} className="event-manage-input" value={draft.Name} maxLength={100} required disabled={disabled}
                        onChange={change => setEdit({stageID: stage.ID, value: {...draft, Name: change.target.value}})} /></div>
                {stateTag(stage.State)}
            </div>
            <div className="event-manage-fields-two">
                <ManageDateField id={`stage-opens-${stage.ID}`} title={t("manage.stages.opens")} help={stage.First ? t("manage.stages.anchoredStart") : stage.State === "upcoming" ? t("manage.stages.help") : t("manage.stages.openedLocked")}
                    value={locks.opens ? localDateTime(stage.OpensAt) : draft.OpensAt} onChange={value => setEdit({stageID: stage.ID, value: {...draft, OpensAt: value}})} disabled={disabled || locks.opens} required />
                <ManageDateField id={`stage-closes-${stage.ID}`} title={t("manage.stages.closes")} help={stage.Last ? t("manage.stages.anchoredFinish") : stage.State === "closed" ? t("manage.stages.closedLocked") : t("manage.stages.help")}
                    value={locks.closes ? localDateTime(stage.ClosesAt) : draft.ClosesAt} onChange={value => setEdit({stageID: stage.ID, value: {...draft, ClosesAt: value}})} disabled={disabled || locks.closes} required />
            </div>
            <LabPolicyNumberField id={`stage-retention-${stage.ID}`} title={t("manage.labs.policy.retention")} value={stage.LabRetentionMinutes ?? null}
                min={0} max={10080} nullable placeholder={t("manage.labs.policy.inherit")} disabled={disabled}
                onCommit={minutes => onPatch(stage, {LabRetentionMinutes: minutes})} />
            <p className="event-stage__lead">{t("manage.labs.group.prepareHelp")}</p>
            <div className="event-stage__foot">
                <div className="event-stage__returnable">
                    <EventSwitch className="event-manage-form__switch" checked={stage.Returnable} disabled={disabled || locks.returnable}
                        onCheckedChange={checked => onPatch(stage, {Returnable: checked})} label={t("manage.stages.returnable")} />
                    <p>{stage.State === "closed" ? t("manage.stages.closedLocked") : t("manage.stages.returnableHelp")}</p>
                </div>
                {canManage && <div className="event-stage__actions">
                    {locks.canClose && <button className="ib-btn" type="button" onClick={() => {setDialogError(""); setDialog("close");}}>{t("manage.stages.closeNow")}</button>}
                    {locks.canDelete && <button className="ib-btn" type="button" onClick={() => {setDialogError(""); setDialog("delete");}}>{t("manage.stages.delete")}</button>}
                    {dirty && <EventButton className="ib-btn ib-btn--primary" type="submit" disabled={saving || !draft.Name.trim()} busy={saving}>{t("manage.stages.save")}</EventButton>}
                </div>}
            </div>
        </form>
        <ConfirmDialog open={dialog !== null} onCancel={() => setDialog(null)} tone="danger" busy={busy} error={dialogError}
            title={t(dialog === "delete" ? "manage.stages.deleteTitle" : "manage.stages.closeNowTitle", {name: stage.Name})}
            description={t(dialog === "delete" ? "manage.stages.deleteBody" : "manage.stages.closeNowBody")}
            confirmLabel={t(dialog === "delete" ? "manage.stages.deleteConfirm" : "manage.stages.closeNowConfirm")} onConfirm={() => void confirm()} />
    </li>;
}

function AddStage({eventID, lifecycle, first, canManage}: {eventID: string; lifecycle: ManageLifecycle; first: boolean; canManage: boolean}) {
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [opens, setOpens] = useState("");
    const [returnable, setReturnable] = useState(false);
    const [saving, setSaving] = useState(false);
    const start = lifecycle.StartAt ?? "";
    const finish = lifecycle.FinishAt ?? "";
    const opensISO = first ? start : isoOf(opens);
    const valid = !!name.trim() && !!opensISO && !!finish;

    async function submit(submitEvent: FormEvent) {
        submitEvent.preventDefault();
        if (!valid || !canManage || saving || !opensISO) return;
        setSaving(true);
        try {
            await createManageStage(eventID, {Name: name.trim(), OpensAt: opensISO, ClosesAt: finish, Returnable: returnable});
            await queryClient.invalidateQueries({queryKey: stagesKey(eventID), exact: true});
            setName("");
            setOpens("");
            setReturnable(false);
            toast.success(t("manage.stages.created"));
        } catch (failure) {toast.error(failureText(failure, t("manage.stages.saveFailed")));}
        finally {setSaving(false);}
    }

    return <form className="event-stage event-stage--new" onSubmit={submit} aria-label={t("manage.stages.addTitle")}>
        <p className="event-stage__lead">{first ? t("manage.stages.firstHelp") : t("manage.stages.nextHelp")}</p>
        <div className="event-manage-fields-two">
            <div className="event-manage-field"><ManageFieldLabel htmlFor="new-stage-name" title={t("manage.stages.name")} help={t("manage.stages.help")} required />
                <input id="new-stage-name" className="event-manage-input" value={name} maxLength={100} required disabled={!canManage || saving} onChange={change => setName(change.target.value)} /></div>
            <ManageDateField id="new-stage-opens" title={t("manage.stages.opens")} help={first ? t("manage.stages.anchoredStart") : t("manage.stages.nextHelp")}
                value={first ? localDateTime(start) : opens} onChange={setOpens} disabled={!canManage || saving || first} required />
        </div>
        <div className="event-stage__foot">
            <div className="event-stage__returnable">
                <EventSwitch className="event-manage-form__switch" checked={returnable} disabled={!canManage || saving} onCheckedChange={setReturnable} label={t("manage.stages.returnable")} />
                <p>{t("manage.stages.returnableHelp")}</p>
            </div>
            <div className="event-stage__actions"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || !valid} busy={saving}>{t("manage.stages.add")}</EventButton></div>
        </div>
    </form>;
}

// «Етапи» on the schedule page: the ordered stages with what each state allows, the instant «Можна повернутися» switch
// (optimistic, queued, rolled back on error), «Закрити зараз» and delete behind a confirmation, and the form for the next stage.
export function StagesManager({eventID, lifecycle, canManage}: {eventID: string; lifecycle: ManageLifecycle; canManage: boolean}) {
    const queryClient = useQueryClient();
    const stages = useQuery({
        queryKey: stagesKey(eventID), queryFn: () => getManageStages(eventID), refetchOnWindowFocus: false, refetchInterval: 30_000,
        // A background refresh never empties the list or shows a loader again.
        placeholderData: keepPreviousData,
    });
    // Returnable saves run one after another; the switches never wait for them.
    const queue = useRef<Promise<void>>(Promise.resolve());
    const stageVersions = useRef(new Map<string, number>());

    function saveStagePatch(stage: ManageStage, patch: Partial<Pick<ManageStage, "Returnable" | "LabRetentionMinutes">>) {
        if (!canManage) return;
        const key = stagesKey(eventID);
        const version = (stageVersions.current.get(stage.ID) ?? 0) + 1;
        stageVersions.current.set(stage.ID, version);
        const before = queryClient.getQueryData<ManageStage[]>(key)?.find(item => item.ID === stage.ID);
        if (!before) return;
        const wanted = {...before, ...patch};
        queryClient.setQueryData<ManageStage[]>(key, current => current?.map(item => item.ID === stage.ID ? wanted : item));
        queue.current = queue.current.then(async () => {
            try {
                const saved = await updateManageStage(eventID, stage.ID, {Returnable: wanted.Returnable, LabRetentionMinutes: wanted.LabRetentionMinutes ?? null});
                const shown = queryClient.getQueryData<ManageStage[]>(key)?.find(item => item.ID === stage.ID);
                if (stageVersions.current.get(stage.ID) === version && JSON.stringify(shown) === JSON.stringify(wanted)) queryClient.setQueryData<ManageStage[]>(key, current => current?.map(item => item.ID === stage.ID ? saved : item));
            } catch (failure) {
                const latest = queryClient.getQueryData<ManageStage[]>(key)?.find(item => item.ID === stage.ID);
                await queryClient.invalidateQueries({queryKey: key, exact: true});
                if (latest && stageVersions.current.get(stage.ID) !== version) queryClient.setQueryData<ManageStage[]>(key, current => current?.map(item => item.ID === stage.ID ? latest : item));
                toast.error(failureText(failure, t("manage.stages.saveFailed")));
            }
        });
    }

    if (stages.isPending) return <section className="event-manage-section event-stages"><EventLoading compact /></section>;
    if (stages.isError && !stages.data) return <section className="event-manage-section event-stages"><EventLoadError compact message={t("manage.stages.loadFailed")} error={stages.error} onRetry={() => void stages.refetch()} /></section>;

    const items = stages.data ?? [];
    const hasSchedule = lifecycle.Configured && !!lifecycle.FinishAt;
    const breaks = shortBreaks(items);
    return <section className="event-manage-section event-stages" aria-labelledby="stages-title">
        <div className="event-manage-section__head"><h2 id="stages-title">{t("manage.stages.title")}</h2><p>{t("manage.stages.help")}</p></div>
        {!hasSchedule && <p className="event-manage-feedback" role="status">{t("manage.stages.needsFinish")}</p>}
        {items.length === 0 ? <EmptyState compact message={t("manage.stages.empty")} /> : <ol className="event-stage-list">
            {items.map(stage => <StageRow key={stage.ID} eventID={eventID} stage={stage} canManage={canManage} onPatch={saveStagePatch} />)}
        </ol>}
        {breaks.map(item => <p className="event-manage-feedback" role="status" key={item.name}>{t("manage.stages.shortBreak", {name: item.name, minutes: item.minutes})}</p>)}
        {hasSchedule && canManage && <AddStage eventID={eventID} lifecycle={lifecycle} first={items.length === 0} canManage={canManage} />}
    </section>;
}
