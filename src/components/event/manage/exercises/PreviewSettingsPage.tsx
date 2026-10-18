"use client";

import {useLayoutEffect, useRef, useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Plus, RotateCcw, X} from "lucide-react";
import {toast} from "react-hot-toast";
import {getPreviewCatalog, getPreviewSettings, previewSettingsIdentity, previewSettingsKey, savePreviewSettings, type PreviewSettingsDraft} from "@/api/managePreviewSettings";
import {useManager} from "@/components/event/manage/ManagerShell";
import {useDraftDirty, useSessionDraftState} from "@/components/event/manage/manualDraft";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {AttachExerciseDialog} from "@/components/event/manage/exercises/AttachExerciseDialog";
import {getManageConfig} from "@/api/manage";
import {getPublishedExercisePreview} from "@/api/manageChallenges";
import type {PreviewSelection} from "@/api/managePreviewSettings";
import {t} from "@/i18n/t";

export function PreviewSettingsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const client = useQueryClient();
    const query = useQuery({queryKey: previewSettingsKey(eventID), queryFn: () => getPreviewSettings(eventID), refetchOnWindowFocus: false});
    const [draft, setDraft] = useSessionDraftState<{eventID: string; value: PreviewSettingsDraft} | null>("preview-settings", null);
    const model = draft?.eventID === eventID ? draft.value : query.data;
    const latest = useRef(draft);
    useLayoutEffect(() => {latest.current = draft;}, [draft]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const availability = useQuery({queryKey: ["event-preview-catalog", eventID], queryFn: () => getPreviewCatalog(eventID, ""), enabled: pickerOpen, refetchOnWindowFocus: false});
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), enabled: pickerOpen, refetchOnWindowFocus: false});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const dirty = !!model && !!query.data && previewSettingsIdentity(model) !== previewSettingsIdentity(query.data);
    useDraftDirty("preview-settings", query.data ? dirty : undefined);
    const update = (value: PreviewSettingsDraft) => setDraft({eventID, value});
    async function save(submitEvent: FormEvent) {
        submitEvent.preventDefault();
        if (!model || !dirty || saving || !canManage) return;
        const submitted = draft;
        setSaving(true); setSaveError(false);
        try {
            client.setQueryData(previewSettingsKey(eventID), await savePreviewSettings(eventID, model));
            if (latest.current === submitted) setDraft(null);
            toast.success(t("manage.previewSettings.saved"));
        } catch {setSaveError(true);} finally {setSaving(false);}
    }
    if (query.isPending) return <EventLoading event={event} />;
    if (query.isError || !query.data || !model) return <EventLoadError message={t("manage.previewSettings.loadFailed")} error={query.error} onRetry={() => void query.refetch()} />;
    const selected = model.Inherit ? query.data.DefaultSelections : model.Selections;
    const groupName = model.GroupNameOverride ?? (query.data.DefaultGroupName || t("manage.previewSettings.defaultGroup"));
    const customDraft = (changes: Partial<PreviewSettingsDraft>): PreviewSettingsDraft => ({
        Inherit: false, GroupNameOverride: groupName, Selections: [...selected], ...changes,
    });
    return <><form className="event-manage-settings" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>{t("manage.previewSettings.title")}</h1><p>{t("manage.previewSettings.description")}</p></div>
            {canManage && (!model.Inherit || model.GroupNameOverride !== null) && <div className="event-manage-heading__actions"><button type="button" className="ib-btn event-preview-restore" onClick={() => update({Inherit: true, Selections: [], GroupNameOverride: null})}><RotateCcw aria-hidden="true" />{t("manage.previewSettings.restore")}</button></div>}
        </header>
        <section className="event-manage-section">
            <label className="event-manage-field"><span>{t("manage.previewSettings.groupName")}</span><input className="event-manage-input" value={groupName} readOnly={!canManage} required maxLength={100} onChange={change => update(customDraft({GroupNameOverride: change.target.value}))} /></label>
            <div className="event-part__actions event-preview-heading"><h2>{t(model.Inherit ? "manage.previewSettings.platformSet" : "manage.previewSettings.eventSet")}</h2></div>
            {selected.length === 0 ? <EmptyState compact className="event-preview-selection-empty" message={t("manage.previewSettings.empty")} /> : <ul className="event-preview-selection">{selected.map(item => <li key={item.ExerciseVersionID}>
                <PreviewExerciseDetails eventID={eventID} item={item} />
                {canManage && <button type="button" className="ib-icon-btn" aria-label={t("manage.previewSettings.remove", {name: item.Name || item.ExerciseVersionID})} onClick={() => update(customDraft({Selections: selected.filter(x => x.ExerciseVersionID !== item.ExerciseVersionID)}))}><X aria-hidden="true" /></button>}
            </li>)}</ul>}
            {canManage && <button className="ib-btn" type="button" onClick={() => setPickerOpen(true)}><Plus aria-hidden="true" />{t("manage.exercises.attach")}</button>}
        </section>
        {saveError && <p role="alert" className="event-pp-field__error">{t("manage.previewSettings.saveFailed")}</p>}
        {canManage && <div className="event-part__actions"><EventButton type="submit" className="ib-btn ib-btn--primary" disabled={!dirty} busy={saving}>{t("common.save")}</EventButton></div>}
    </form>
            {pickerOpen && (availability.isPending || config.isPending) && <EventLoading event={event} compact />}
            {pickerOpen && (availability.isError || config.isError) && <EventLoadError compact message={t("manage.previewSettings.catalogFailed")} error={availability.error || config.error} onRetry={() => {void availability.refetch(); void config.refetch();}} />}
            {canManage && availability.data && config.data && <AttachExerciseDialog eventID={eventID} infrastructureAllowed={config.data.InfrastructureAllowed && query.data.DynamicAllocated} open={pickerOpen} onClose={() => setPickerOpen(false)} onAttached={async () => {}}
                selectionAdapter={{ineligible: availability.data.filter(item => !item.Eligible).map(item => ({ID: item.ID, Name: item.Name, Reason: item.Reason})), variantInfrastructure: Object.fromEntries(availability.data.map(item => [item.ExerciseVersionID, Object.fromEntries(item.Variants.map(variant => [variant.Position, variant.Infrastructure]))])), availableVariants: Object.fromEntries(availability.data.filter(item => item.Eligible).map(item => [item.ExerciseVersionID, item.Variants.map(variant => variant.Position)])), attachedVersionIDs: selected.map(item => item.ExerciseVersionID), onSelect: async (choice, variant) => {
                    const available = availability.data.find(item => item.ExerciseVersionID === choice.PublishedVersionID);
                    const chosen = available?.Variants.find(item => item.Position === variant);
                    if (!chosen) throw new Error(t("manage.previewSettings.unavailable"));
                    setDraft(current => {
                        const currentModel = current?.eventID === eventID ? current.value : model;
                        const currentSelections = currentModel.Inherit ? query.data!.DefaultSelections : currentModel.Selections;
                        return {eventID, value: {...currentModel, Inherit: false, GroupNameOverride: currentModel.GroupNameOverride ?? (query.data!.DefaultGroupName || t("manage.previewSettings.defaultGroup")), Selections: [...currentSelections.filter(item => item.ExerciseVersionID !== choice.PublishedVersionID), {ExerciseVersionID: choice.PublishedVersionID, VariantID: chosen.ID, VariantIndex: chosen.Index, VariantPosition: variant, Name: choice.Name}]}};
                    });
                }}} />}
    </>;
}

function PreviewExerciseDetails({eventID, item}: {eventID: string; item: PreviewSelection}) {
    const [open, setOpen] = useState(false);
    const preview = useQuery({queryKey: ["event-exercise-preview", eventID, item.ExerciseVersionID, item.VariantPosition ?? 0], queryFn: () => getPublishedExercisePreview(eventID, item.ExerciseVersionID, item.VariantPosition ?? 0), enabled: open});
    return <div><button className="ib-link" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{item.Name || item.ExerciseVersionID}</button>
        {open && <div className="event-exercise-editor__preview">{preview.isPending ? <EventLoading compact /> : preview.isError ? <EventLoadError compact message={t("manage.exercises.attachDialog.previewFailed")} error={preview.error} onRetry={() => void preview.refetch()} /> : <><h3>{preview.data.Name}</h3><p>{preview.data.Description}</p><ol>{preview.data.Tasks.map((task, index) => <li key={index}><strong>{task.Name}</strong><span>{t(`manage.exercises.difficulty.${task.Difficulty}`)}</span></li>)}</ol></>}</div>}
    </div>;
}
