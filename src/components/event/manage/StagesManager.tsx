"use client";

import {useDraftDirty, useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useRef, useState, type FormEvent} from "react";
import {CircleHelp} from "lucide-react";
import {keepPreviousData, replaceEqualDeep, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage, ApiErrorCode} from "@/api/apiErrors";
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
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {draftOfStage, isoOf, localDateTime, shortBreaks, stageDirty, stageLocks, type StageDraft} from "./stagesModel";
import "./stagesManage.css";

const stagesKey = (eventID: string) => ["event-management-stages", eventID];

// The server's reason for a refused stage change, else the caller's text.
const failureText = (failure: unknown, fallback: string) => failure instanceof ManageApiError ? apiErrorMessage(failure.code, fallback) : fallback;

type StageFieldErrors = {name?: string; opens?: string; closes?: string};
function stageFailureFields(failure: unknown): StageFieldErrors | null {
    if (!(failure instanceof ManageApiError)) return null;
    if (failure.code === ApiErrorCode.StageNameExists || failure.code === ApiErrorCode.NameInvalidCharacters) return {name: apiErrorMessage(failure.code)};
    if (failure.code === ApiErrorCode.StageOverlap) return {opens: apiErrorMessage(failure.code), closes: apiErrorMessage(failure.code)};
    return null;
}

const stateTag = (state: ManageStage["State"]) => <span className={`ib-tag ib-tag--sm${state === "open" ? " ib-tag--ok" : ""}`}>{t(`manage.stages.state.${state}`)}</span>;

function ReturnableSwitch({checked, disabled, onCheckedChange}: {checked: boolean; disabled: boolean; onCheckedChange: (checked: boolean) => void}) {
    const title = t("manage.stages.returnable");
    return <div className="event-stage__returnable-control">
        <EventSwitch className="event-manage-form__switch" checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} label={title} />
        <EventTooltip content={<span className="event-brand-tooltip-copy">{t("manage.stages.returnableHelp")}</span>}>
            {id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title})} aria-describedby={id}><CircleHelp size={15} /></button>}
        </EventTooltip>
    </div>;
}

function StageBoundaryField({id, title, help, value, bound, eventDate, disabled, opening, onChange, onBoundChange, error}: {
    id: string; title: string; help: string; value: string; bound: boolean; eventDate: string | null;
    disabled: boolean; opening: boolean; error?: string; onChange: (value: string) => void; onBoundChange: (bound: boolean) => void;
}) {
    const missingFinish = !opening && !eventDate && !disabled;
    return <div className="event-stage__boundary">
        <ManageDateField id={id} title={title} help={help} value={value} onChange={onChange} disabled={disabled || bound} required error={error} />
        <div className="event-stage__date-source" role="radiogroup" aria-label={t(opening ? "manage.stages.opensSource" : "manage.stages.closesSource")} aria-describedby={missingFinish ? `${id}-unavailable` : undefined}>
            <label><input type="radio" name={`${id}-source`} checked={!bound} disabled={disabled} onChange={() => onBoundChange(false)} /><span>{t("manage.stages.source.custom")}</span></label>
            <label><input type="radio" name={`${id}-source`} checked={bound} disabled={disabled || !eventDate} onChange={() => onBoundChange(true)} /><span>{t(opening ? "manage.stages.source.eventStart" : "manage.stages.source.eventFinish")}</span></label>
        </div>
        {missingFinish && <p className="event-stage__lead" id={`${id}-unavailable`}>{t("manage.stages.boundFinishUnavailable")}</p>}
    </div>;
}

function StageRow({eventID, stage, lifecycle, canManage, onPatch}: {
    eventID: string; stage: ManageStage; lifecycle: ManageLifecycle; canManage: boolean; onPatch: (stage: ManageStage, patch: Partial<Pick<ManageStage, "Returnable" | "LabRetentionMinutes">>) => void;
}) {
    const queryClient = useQueryClient();
    const locks = stageLocks(stage);
    const [edit, setEdit] = useSessionDraftState<{stageID: string; value: StageDraft} | null>(`stage-${stage.ID}`, null);
    // Drafts saved before source selection existed inherit the server's migrated source choices.
    const draft = edit?.stageID === stage.ID ? {...draftOfStage(stage), ...edit.value} : draftOfStage(stage);
    const dirty = stageDirty(stage, draft);
    useDraftDirty(`stage-${stage.ID}`, dirty);
    const [saving, setSaving] = useState(false);
    const [dialog, setDialog] = useState<"close" | "delete" | null>(null);
    const [busy, setBusy] = useState(false);
    const [dialogError, setDialogError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<StageFieldErrors>({});

    const apply = (saved: ManageStage) => queryClient.setQueryData<ManageStage[]>(stagesKey(eventID), current => (current ?? []).map(item => item.ID === saved.ID ? saved : item).sort((a, b) => Date.parse(a.OpensAt) - Date.parse(b.OpensAt)));
    const refresh = () => queryClient.invalidateQueries({queryKey: stagesKey(eventID), exact: true});

    async function save(submitEvent: FormEvent) {
        submitEvent.preventDefault();
        if (!canManage || !dirty || saving) return;
        const input: StageUpdateInput = {Name: draft.Name.trim()};
        if (!locks.opens) {
            input.OpensWithEvent = !!draft.OpensWithEvent;
            if (!draft.OpensWithEvent) input.OpensAt = draft.OpensAt === localDateTime(stage.OpensAt) ? stage.OpensAt : isoOf(draft.OpensAt) ?? undefined;
        }
        if (!locks.closes) {
            input.ClosesWithEvent = !!draft.ClosesWithEvent;
            if (!draft.ClosesWithEvent) input.ClosesAt = draft.ClosesAt === localDateTime(stage.ClosesAt) ? stage.ClosesAt : isoOf(draft.ClosesAt) ?? undefined;
        }
        setSaving(true);
        setFieldErrors({});
        try {
            apply(await updateManageStage(eventID, stage.ID, input));
            setEdit(current => current === edit ? null : current);
            toast.success(t("manage.stages.saved"));
        } catch (failure) {const fields = stageFailureFields(failure); if (fields) setFieldErrors(fields); else toast.error(failureText(failure, t("manage.stages.saveFailed")));}
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
                    <input id={`stage-name-${stage.ID}`} aria-invalid={!!fieldErrors.name || undefined} aria-describedby={fieldErrors.name ? `stage-name-${stage.ID}-error` : undefined} className="event-manage-input" value={draft.Name} maxLength={100} required disabled={disabled}
                        onChange={change => {setFieldErrors(current => ({...current, name: undefined})); setEdit({stageID: stage.ID, value: {...draft, Name: change.target.value}});}} />{fieldErrors.name && <p id={`stage-name-${stage.ID}-error`} className="event-manage-validation" role="alert">{fieldErrors.name}</p>}</div>
                {stateTag(stage.State)}
            </div>
            <div className="event-manage-fields-two">
                <StageBoundaryField error={fieldErrors.opens} id={`stage-opens-${stage.ID}`} title={t("manage.stages.opens")} help={stage.State === "upcoming" ? t("manage.stages.windowHelp") : t("manage.stages.openedLocked")}
                    value={locks.opens ? localDateTime(stage.OpensAt) : draft.OpensWithEvent ? localDateTime(lifecycle.StartAt) : draft.OpensAt} bound={!!draft.OpensWithEvent} eventDate={lifecycle.StartAt} opening
                    onChange={value => {setFieldErrors(current => ({...current, opens: undefined})); setEdit({stageID: stage.ID, value: {...draft, OpensAt: value}});}} onBoundChange={bound => setEdit({stageID: stage.ID, value: {...draft, OpensWithEvent: bound}})} disabled={disabled || locks.opens} />
                <StageBoundaryField error={fieldErrors.closes} id={`stage-closes-${stage.ID}`} title={t("manage.stages.closes")} help={stage.State === "closed" ? t("manage.stages.closedLocked") : t("manage.stages.windowHelp")}
                    value={locks.closes ? localDateTime(stage.ClosesAt) : draft.ClosesWithEvent ? localDateTime(lifecycle.FinishAt) : draft.ClosesAt} bound={!!draft.ClosesWithEvent} eventDate={lifecycle.FinishAt} opening={false}
                    onChange={value => {setFieldErrors(current => ({...current, closes: undefined})); setEdit({stageID: stage.ID, value: {...draft, ClosesAt: value}});}} onBoundChange={bound => setEdit({stageID: stage.ID, value: {...draft, ClosesWithEvent: bound}})} disabled={disabled || locks.closes} />
            </div>
            <LabPolicyNumberField id={`stage-retention-${stage.ID}`} title={t("manage.labs.policy.retention")} value={stage.LabRetentionMinutes ?? null}
                min={0} max={10080} nullable placeholder={t("manage.labs.policy.inherit")} disabled={disabled}
                onCommit={minutes => onPatch(stage, {LabRetentionMinutes: minutes})} />
            <p className="event-stage__lead">{t("manage.labs.group.prepareHelp")}</p>
            <div className="event-stage__foot">
                <div className="event-stage__returnable">
                    <ReturnableSwitch checked={stage.Returnable} disabled={disabled || locks.returnable}
                        onCheckedChange={checked => onPatch(stage, {Returnable: checked})} />
                    <p>{t(stage.Returnable ? "manage.stages.returnableOn" : "manage.stages.returnableOff")}</p>
                    {locks.returnable && <p>{t("manage.stages.returnableLocked")}</p>}
                </div>
                {canManage && <div className="event-stage__actions">
                    {locks.canClose && <button className="ib-btn" type="button" onClick={() => {setDialogError(""); setDialog("close");}}>{t("manage.stages.closeNow")}</button>}
                    {locks.canDelete && <button className="ib-btn" type="button" onClick={() => {setDialogError(""); setDialog("delete");}}>{t("manage.stages.delete")}</button>}
                    {<EventButton saveDirty={dirty} className="ib-btn ib-btn--primary" type="submit" disabled={saving || !draft.Name.trim()} busy={saving}>{t("manage.stages.save")}</EventButton>}
                </div>}
            </div>
        </form>
        <ConfirmDialog open={dialog !== null} onCancel={() => setDialog(null)} tone="danger" busy={busy} error={dialogError}
            title={t(dialog === "delete" ? "manage.stages.deleteTitle" : "manage.stages.closeNowTitle", {name: stage.Name})}
            description={t(dialog === "delete" ? "manage.stages.deleteBody" : "manage.stages.closeNowBody")}
            confirmLabel={t(dialog === "delete" ? "manage.stages.deleteConfirm" : "manage.stages.closeNowConfirm")} onConfirm={() => void confirm()} />
    </li>;
}

function AddStage({eventID, lifecycle, canManage}: {eventID: string; lifecycle: ManageLifecycle; canManage: boolean}) {
    const queryClient = useQueryClient();
    const [name, setName] = useSessionDraftState("new-stage-name", "");
    const [opens, setOpens] = useSessionDraftState("new-stage-opens", "");
    const [closes, setCloses] = useSessionDraftState("new-stage-closes", "");
    const [opensWithEvent, setOpensWithEvent] = useSessionDraftState("new-stage-opens-with-event", false);
    const [closesWithEvent, setClosesWithEvent] = useSessionDraftState("new-stage-closes-with-event", false);
    const [returnable, setReturnable] = useSessionDraftState("new-stage-returnable", false);
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<StageFieldErrors>({});
    const opensISO = opensWithEvent ? lifecycle.StartAt : isoOf(opens);
    const closesISO = closesWithEvent ? lifecycle.FinishAt : isoOf(closes);
    const valid = !!name.trim() && !!opensISO && !!closesISO && Date.parse(opensISO) < Date.parse(closesISO);

    async function submit(submitEvent: FormEvent) {
        submitEvent.preventDefault();
        if (!valid || !canManage || saving || !opensISO || !closesISO) return;
        setSaving(true);
        setFieldErrors({});
        try {
            await createManageStage(eventID, {Name: name.trim(), OpensAt: opensISO, ClosesAt: closesISO, Returnable: returnable, OpensWithEvent: opensWithEvent, ClosesWithEvent: closesWithEvent});
            await queryClient.invalidateQueries({queryKey: stagesKey(eventID), exact: true});
            setName("");
            setOpens("");
            setCloses("");
            setOpensWithEvent(false);
            setClosesWithEvent(false);
            setReturnable(false);
            toast.success(t("manage.stages.created"));
        } catch (failure) {const fields = stageFailureFields(failure); if (fields) setFieldErrors(fields); else toast.error(failureText(failure, t("manage.stages.saveFailed")));}
        finally {setSaving(false);}
    }

    return <form className="event-stage event-stage--new" onSubmit={submit} aria-label={t("manage.stages.addTitle")}>
        <p className="event-stage__lead">{t("manage.stages.newHelp")}</p>
        <div className="event-manage-field"><ManageFieldLabel htmlFor="new-stage-name" title={t("manage.stages.name")} help={t("manage.stages.help")} required />
                <input aria-invalid={!!fieldErrors.name || undefined} aria-describedby={fieldErrors.name ? "new-stage-name-error" : undefined} id="new-stage-name" className="event-manage-input" value={name} maxLength={100} required disabled={!canManage || saving} onChange={change => {setName(change.target.value); setFieldErrors(current => ({...current, name: undefined}));}} />{fieldErrors.name && <p id="new-stage-name-error" className="event-manage-validation" role="alert">{fieldErrors.name}</p>}</div>
        <div className="event-manage-fields-two">
            <StageBoundaryField error={fieldErrors.opens} id="new-stage-opens" title={t("manage.stages.opens")} help={t("manage.stages.windowHelp")}
                value={opensWithEvent ? localDateTime(lifecycle.StartAt) : opens} bound={opensWithEvent} eventDate={lifecycle.StartAt} opening onChange={value => {setOpens(value); setFieldErrors(current => ({...current, opens: undefined}));}} onBoundChange={setOpensWithEvent} disabled={!canManage || saving} />
            <StageBoundaryField error={fieldErrors.closes} id="new-stage-closes" title={t("manage.stages.closes")} help={t("manage.stages.windowHelp")}
                value={closesWithEvent ? localDateTime(lifecycle.FinishAt) : closes} bound={closesWithEvent} eventDate={lifecycle.FinishAt} opening={false} onChange={value => {setCloses(value); setFieldErrors(current => ({...current, closes: undefined}));}} onBoundChange={setClosesWithEvent} disabled={!canManage || saving} />
        </div>
        <div className="event-stage__foot">
            <div className="event-stage__returnable">
                <ReturnableSwitch checked={returnable} disabled={!canManage || saving} onCheckedChange={setReturnable} />
                <p>{t(returnable ? "manage.stages.returnableOn" : "manage.stages.returnableOff")}</p>
            </div>
            <div className="event-stage__actions"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || !valid} busy={saving}>{t("manage.stages.add")}</EventButton></div>
        </div>
    </form>;
}

// «Етапи» on the schedule page: the ordered stages with what each state allows, the instant «Можна повернутися» switch
// (optimistic, queued, rolled back on error), «Закрити зараз» and delete behind a confirmation, and the form for the next stage.
export function StagesManager({eventID, lifecycle, canManage}: {eventID: string; lifecycle: ManageLifecycle; canManage: boolean}) {
    const queryClient = useQueryClient();
    type Controls = Pick<ManageStage, "Returnable" | "LabRetentionMinutes">;
    type Intent = {desired: Controls; confirmed: Controls; pending: number; version: number};
    const byEvent = useRef(new Map<string, Map<string, Intent>>());
    function eventIntents() {
        if (!byEvent.current.has(eventID)) byEvent.current.set(eventID, new Map());
        return byEvent.current.get(eventID)!;
    }
    const queue = useRef<Promise<void>>(Promise.resolve());
    const controlsOf = (stage: ManageStage): Controls => ({Returnable: stage.Returnable, LabRetentionMinutes: stage.LabRetentionMinutes ?? null});
    const preservePending = (rows: ManageStage[]) => rows.map(row => {
        const intent = eventIntents().get(row.ID);
        return intent?.pending ? {...row, ...intent.desired} : row;
    });
    const stages = useQuery({
        queryKey: stagesKey(eventID),
        queryFn: async ({signal}) => {
            // A GET that started before or during a write cannot publish stale control values afterwards.
            const intents = eventIntents();
            const started = new Map([...intents].map(([id, intent]) => [id, {version: intent.version, pending: intent.pending}]));
            const rows = await getManageStages(eventID);
            signal.throwIfAborted();
            return rows.map(row => {
                const intent = intents.get(row.ID);
                if (!intent) return row;
                const before = started.get(row.ID);
                if (intent.pending || before?.pending || before?.version !== intent.version) return {...row, ...intent.desired};
                intent.confirmed = controlsOf(row);
                intent.desired = intent.confirmed;
                return row;
            });
        },
        // Protect other cache publications too, including explicit form/close replies.
        structuralSharing: (previous, next) => replaceEqualDeep(previous, preservePending(next as ManageStage[])),
        refetchOnWindowFocus: false, refetchInterval: 30_000, placeholderData: keepPreviousData,
    });

    function saveStagePatch(stage: ManageStage, patch: Partial<Controls>) {
        if (!canManage) return;
        const key = stagesKey(eventID);
        const before = queryClient.getQueryData<ManageStage[]>(key)?.find(item => item.ID === stage.ID);
        if (!before) return;
        const intents = eventIntents();
        let intent = intents.get(stage.ID);
        if (!intent) {
            const controls = controlsOf(before);
            intent = {desired: controls, confirmed: controls, pending: 0, version: 0};
            intents.set(stage.ID, intent);
        }
        const wanted = {...intent.desired, ...patch};
        intent.desired = wanted;
        intent.pending++;
        const version = ++intent.version;
        const operation = intent;
        queryClient.setQueryData<ManageStage[]>(key, current => current?.map(item => item.ID === stage.ID ? {...item, ...wanted} : item));
        queue.current = queue.current.then(async () => {
            try {
                const saved = await updateManageStage(eventID, stage.ID, wanted);
                operation.confirmed = controlsOf(saved);
                operation.pending--;
                if (operation.version === version) operation.desired = operation.confirmed;
                queryClient.setQueryData<ManageStage[]>(key, current => current?.map(item => item.ID === stage.ID ? {
                    ...saved,
                    // Keep schedule/name/state updates published after this control command started.
                    ...Object.fromEntries((["Name", "OpensAt", "ClosesAt", "OpensWithEvent", "ClosesWithEvent", "State", "First", "Last", "DeployLeadMinutes"] as const)
                        .filter(field => item[field] !== before[field]).map(field => [field, item[field]])),
                    ...(operation.pending ? operation.desired : {}),
                } : item));
            } catch (failure) {
                operation.pending--;
                if (operation.version === version) operation.desired = operation.confirmed;
                // Roll back only the failed final choice; newer queued intent survives its exact refetch.
                queryClient.setQueryData<ManageStage[]>(key, current => current?.map(item => item.ID === stage.ID ? {...item, ...operation.desired} : item));
                await queryClient.invalidateQueries({queryKey: key, exact: true});
                toast.error(failureText(failure, t("manage.stages.saveFailed")));
            }
        });
    }

    if (stages.isPending) return <section className="event-manage-section event-stages"><EventLoading compact /></section>;
    if (stages.isError && !stages.data) return <section className="event-manage-section event-stages"><EventLoadError compact message={t("manage.stages.loadFailed")} error={stages.error} onRetry={() => void stages.refetch()} /></section>;

    const items = stages.data ?? [];
    const hasSchedule = lifecycle.Configured && !!lifecycle.StartAt;
    const breaks = shortBreaks(items);
    return <section className="event-manage-section event-stages" aria-labelledby="stages-title">
        <div className="event-manage-section__head"><h2 id="stages-title">{t("manage.stages.title")}</h2><p>{t("manage.stages.help")}</p></div>
        {!hasSchedule && <p className="event-manage-feedback" role="status">{t("manage.stages.needsSchedule")}</p>}
        {items.length === 0 ? <EmptyState compact message={t("manage.stages.empty")} /> : <ol className="event-stage-list">
            {items.map(stage => <StageRow key={stage.ID} eventID={eventID} stage={stage} lifecycle={lifecycle} canManage={canManage} onPatch={saveStagePatch} />)}
        </ol>}
        {breaks.map(item => <p className="event-manage-feedback" role="status" key={item.name}>{t("manage.stages.shortBreak", {name: item.name, minutes: item.minutes})}</p>)}
        {hasSchedule && canManage && <AddStage eventID={eventID} lifecycle={lifecycle} canManage={canManage} />}
    </section>;
}
