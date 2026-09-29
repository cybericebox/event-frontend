"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {AlertTriangle} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageConfig, manageConfigInput, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";


export default function ParticipationSettingsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; value: ManageConfigInput} | null>(null);
    const [saving, setSaving] = useState(false);
    const config = edit?.eventID === eventID ? edit.value : configQuery.data ? manageConfigInput(configQuery.data) : null;
    const update = (patch: Partial<ManageConfigInput>) => {if (config) setEdit({eventID, value: {...config, ...patch}});};
    const dirty = !!config && !!configQuery.data && JSON.stringify(config) !== JSON.stringify(manageConfigInput(configQuery.data));
    const locked = !!lifecycleQuery.data?.Configured && lifecycleQuery.data.Status !== "not_published";
    const valid = !!config && config.Participation !== null && (config.Participation !== 1 || (config.MaxTeamSize >= 1 && (!config.MinTeamSize || config.MinTeamSize <= config.MaxTeamSize)));
    const disabled = !canManage || saving;

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || !valid || disabled || !dirty) return;
        setSaving(true);
        try {
            const updated = await putManageConfig(eventID, config);
            queryClient.setQueryData(["event-management-config", eventID], updated);
            queryClient.setQueryData<typeof event>(["event-manager-public-info"], current => current ? {...current, Participation: updated.Participation} : current);
            setEdit(null);
            toast.success(t("manage.participation.saved"));
        } catch (failure) {toast.error(failure instanceof ManageApiError && failure.status === 409 ? t("manage.participation.locked") : t("manage.participation.saveFailed"));}
        finally {setSaving(false);}
    }

    if (configQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || lifecycleQuery.isError || !config) return <div className="event-manage-error" role="alert"><h1>{t("manage.participation.loadFailed")}</h1><button className="ib-btn" onClick={() => {void configQuery.refetch(); void lifecycleQuery.refetch();}}>{t("common.retry")}</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>{t("manage.participation.title")}</h1><p>{t("manage.participation.subtitle")}</p></div></header>
        <section className="event-manage-section">
            <ManageFieldLabel title={t("manage.participation.title")} help={t("manage.participation.help")} required />
            <div className="event-manage-choice-group" role="radiogroup" aria-label={t("manage.participation.type")}>
                <label><input type="radio" name="participation" checked={config.Participation === 0} onChange={() => update({Participation: 0})} disabled={disabled || locked} /><div className="event-manage-choice-content"><strong>{t("manage.participation.individual.title")}</strong><ul className="event-manage-choice-points"><li>{t("manage.participation.individual.point1")}</li><li>{t("manage.participation.individual.point2")}</li><li>{t("manage.participation.individual.point3")}</li></ul></div></label>
                <label><input type="radio" name="participation" checked={config.Participation === 1} onChange={() => update({Participation: 1})} disabled={disabled || locked} /><div className="event-manage-choice-content"><strong>{t("manage.participation.team.title")}</strong><ul className="event-manage-choice-points"><li>{t("manage.participation.team.point1")}</li><li>{t("manage.participation.team.point2")}</li><li>{t("manage.participation.team.point3")}</li></ul></div></label>
            </div>
            {config.Participation === 1 && <div className="event-manage-fields-two">
                <div className="event-manage-field"><ManageFieldLabel htmlFor="max-team-size" title={t("manage.participation.maxTeamSize")} help={t("manage.participation.maxTeamSizeHelp")} required /><input id="max-team-size" className="event-manage-input" type="number" min={1} value={config.MaxTeamSize} onChange={change => update({MaxTeamSize: Number(change.target.value)})} disabled={disabled || locked} /></div>
                <div className="event-manage-field"><ManageFieldLabel htmlFor="min-team-size" title={t("manage.participation.minTeamSize")} help={t("manage.participation.minTeamSizeHelp")} /><input id="min-team-size" className="event-manage-input" type="number" min={1} max={config.MaxTeamSize} placeholder={String(Math.min(2, config.MaxTeamSize || 2))} value={config.MinTeamSize ?? ""} onChange={change => update({MinTeamSize: change.target.value ? Number(change.target.value) : null})} disabled={disabled || locked} /></div>
            </div>}
            <div className="event-manage-warning" role="note"><AlertTriangle size={18} aria-hidden="true" /><span>{t("manage.participation.lockWarning")}</span></div>
        </section>
        <section className="event-manage-section">
            <ManageFieldLabel title={t("manage.participation.infrastructure")} help={t("manage.participation.infrastructureHelp")} />
            <p className="event-manage-readonly-note">{configQuery.data?.InfrastructureAllowed ? t("manage.participation.infrastructureAllowed") : t("manage.participation.infrastructureDenied")}</p>
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !valid} busy={saving}>{t("common.save")}</EventButton></div>}
    </form>;
}
