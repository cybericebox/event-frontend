"use client";

import {useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageConfig, putManageLifecycle, manageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";


export function RegistrationSettings() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; registration: 0 | 1 | 2; joinPolicy: 0 | 1; maxTeams: number | null; allowPseudonyms: boolean} | null>(null);
    const [saving, setSaving] = useState(false);
    const config = configQuery.data;
    const lifecycle = lifecycleQuery.data;
    const registration = edit?.eventID === eventID ? edit.registration : config?.Registration;
    const joinPolicy = edit?.eventID === eventID ? edit.joinPolicy : lifecycle?.JoinPolicy;
    const maxTeams = edit?.eventID === eventID ? edit.maxTeams : config?.MaxTeams;
    const allowPseudonyms = edit?.eventID === eventID ? edit.allowPseudonyms : config?.AllowPseudonyms;
    const registrationDirty = config !== undefined && (registration !== config.Registration || maxTeams !== config.MaxTeams || allowPseudonyms !== config.AllowPseudonyms);
    const joinDirty = lifecycle !== undefined && joinPolicy !== lifecycle.JoinPolicy;
    const dirty = registrationDirty || joinDirty;

    function update(patch: Partial<{registration: 0 | 1 | 2; joinPolicy: 0 | 1; maxTeams: number | null; allowPseudonyms: boolean}>) {
        if (registration === undefined || joinPolicy === undefined || maxTeams === undefined || allowPseudonyms === undefined) return;
        setEdit({eventID, registration: patch.registration ?? registration, joinPolicy: patch.joinPolicy ?? joinPolicy, maxTeams: patch.maxTeams === undefined ? maxTeams : patch.maxTeams, allowPseudonyms: patch.allowPseudonyms ?? allowPseudonyms});
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || !lifecycle || registration === undefined || allowPseudonyms === undefined || joinPolicy === undefined || maxTeams === undefined || (maxTeams !== null && (!Number.isInteger(maxTeams) || maxTeams < 1)) || !canManage || saving || !dirty || (joinDirty && !lifecycle.Configured)) return;
        setSaving(true);
        try {
            if (registrationDirty) {
                const updated = await putManageConfig(eventID, {...manageConfigInput(config), Registration: registration, MaxTeams: maxTeams, AllowPseudonyms: allowPseudonyms});
                queryClient.setQueryData(["event-management-config", eventID], updated);
                queryClient.setQueryData<typeof event>(["event-manager-public-info"], current => current ? {...current, Registration: updated.Registration} : current);
            }
            if (joinDirty) {
                const updated = await putManageLifecycle(eventID, {
                    JoinPolicy: joinPolicy, PublishAt: lifecycle.PublishAt, StartAt: lifecycle.StartAt,
                    FinishAt: lifecycle.FinishAt, WithdrawAt: lifecycle.WithdrawAt,
                });
                queryClient.setQueryData(["event-management-lifecycle", eventID], updated);
            }
            setEdit(null);
            toast.success(t("manage.registration.saved"));
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            toast.error(status === 409 ? t("manage.settingsConflict") : t("manage.registration.saveFailed"));
        } finally {setSaving(false);}
    }

    const scheduleHint = t("manage.registration.scheduleHint").split("{link}");
    if (configQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || lifecycleQuery.isError || !config || !lifecycle) return <EventLoadError message={t("manage.registration.loadFailed")} onRetry={() => {void configQuery.refetch(); void lifecycleQuery.refetch();}} />;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <section className="event-manage-section">
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.registration.type")} help={t("manage.registration.typeHelp")} helpPlacement="bottom" required /><EventSelect ariaLabel={t("manage.registration.type")} value={String(registration)} options={[{value: "0", label: t("manage.registration.closed")}, {value: "1", label: t("manage.registration.approval")}, {value: "2", label: t("manage.registration.open")}]} onValueChange={value => update({registration: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving} /></div>
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.registration.joinPeriod")} help={t("manage.registration.joinPeriodHelp")} helpPlacement="bottom" required />
                <div className="event-manage-choice-group" role="radiogroup" aria-label={t("manage.registration.joinPeriod")}>
                    <label><input type="radio" name="join-policy" checked={joinPolicy === 0} onChange={() => update({joinPolicy: 0})} disabled={!canManage || saving || !lifecycle.Configured} /><span><strong>{t("manage.registration.beforeStart")}</strong><small>{t("manage.registration.beforeStartNote")}</small></span></label>
                    <label><input type="radio" name="join-policy" checked={joinPolicy === 1} onChange={() => update({joinPolicy: 1})} disabled={!canManage || saving || !lifecycle.Configured} /><span><strong>{t("manage.registration.duringEvent")}</strong><small>{t("manage.registration.duringEventNote")}</small></span></label>
                </div>
                {!lifecycle.Configured && <small>{scheduleHint[0]}<Link href="/manage/schedule">{t("manage.registration.scheduleLink")}</Link>{scheduleHint[1]}</small>}
            </div>
            {config.Participation === 1 && <div className="event-manage-field"><ManageFieldLabel htmlFor="max-teams" title={t("manage.registration.maxTeams")} help={t("manage.registration.maxTeamsHelp")} /><input id="max-teams" className="event-manage-input" type="number" min={1} value={maxTeams ?? ""} onChange={change => update({maxTeams: change.target.value ? Number(change.target.value) : null})} disabled={!canManage || saving} placeholder={t("manage.registration.noLimit")} /></div>}
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.registration.pseudonyms")} help={t("manage.registration.pseudonymsHelp")} /><EventSwitch className="event-manage-form__switch" checked={!!allowPseudonyms} onCheckedChange={checked => update({allowPseudonyms: checked})} disabled={!canManage || saving} label={t("manage.registration.allowPseudonyms")} /></div>
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || (maxTeams !== null && maxTeams !== undefined && (!Number.isInteger(maxTeams) || maxTeams < 1))} busy={saving}>{t("common.save")}</EventButton></div>}
    </form>;
}
