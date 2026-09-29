"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageLifecycle, getManageScoring, putManageScoring, type ManageScoringInput} from "@/api/manage";
import {EventLoading} from "@/components/event/EventLoading";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {withTimeDecayFloor} from "@/components/event/manage/scoringFloor";

const scoringModes = () => [
    {value: "0", label: t("manage.scoring.mode.fixed")},
    {value: "1", label: t("manage.scoring.mode.solves")},
    {value: "2", label: t("manage.scoring.mode.order")},
    {value: "3", label: t("manage.scoring.mode.time")},
];

export default function ScoringPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const scoringQuery = useQuery({queryKey: ["event-management-scoring", eventID], queryFn: () => getManageScoring(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; value: ManageScoringInput} | null>(null);
    const [saving, setSaving] = useState(false);
    const original = scoringQuery.data;
    const value = edit?.eventID === eventID ? edit.value : original ? {Mode: original.Mode, MinPoints: original.MinPoints, MaxPoints: original.MaxPoints, FloorAtPercent: original.FloorAtPercent, ForceEventScoring: original.ForceEventScoring} : null;
    const dirty = !!value && !!original && (value.Mode !== original.Mode || value.MinPoints !== original.MinPoints || value.MaxPoints !== original.MaxPoints || value.FloorAtPercent !== original.FloorAtPercent || value.ForceEventScoring !== original.ForceEventScoring);
    const dynamic = value?.Mode !== 0;
    const lifecycle = lifecycleQuery.data;
    const modeProblem = value?.Mode === 1 || value?.Mode === 2
        ? lifecycle?.JoinPolicy !== 0 ? t("manage.scoring.needsJoinClose") : ""
        : value?.Mode === 3 && !lifecycle?.FinishAt ? t("manage.scoring.needsFinish") : "";
    const valid = !!value && (!dynamic || (Number.isInteger(value.MinPoints) && value.MinPoints > 0 && Number.isInteger(value.MaxPoints) && value.MaxPoints > value.MinPoints && (value.Mode === 3 || (Number.isInteger(value.FloorAtPercent) && value.FloorAtPercent >= 1 && value.FloorAtPercent <= 100)))) && !modeProblem;

    function update(patch: Partial<ManageScoringInput>) {
        if (value) setEdit({eventID, value: {...value, ...patch}});
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!value || !valid || !dirty || !canManage || saving) return;
        setSaving(true);
        try {
            const updated = await putManageScoring(eventID, withTimeDecayFloor(value));
            queryClient.setQueryData(["event-management-scoring", eventID], updated);
            setEdit(null);
            toast.success(t("manage.scoring.saved"));
        } catch {toast.error(t("manage.scoring.saveError"));}
        finally {setSaving(false);}
    }

    if (scoringQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (scoringQuery.isError || lifecycleQuery.isError || !value) return <div className="event-manage-error" role="alert"><h1>{t("manage.scoring.loadError")}</h1><button className="ib-btn" onClick={() => {void scoringQuery.refetch(); void lifecycleQuery.refetch();}}>{t("common.retry")}</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>{t("manage.scoring.title")}</h1><p>{t("manage.scoring.intro")}</p></div></header>
        <section className="event-manage-section">
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.scoring.modeLabel")} help={t("manage.scoring.modeHelp")} required /><EventSelect ariaLabel={t("manage.scoring.modeLabel")} value={String(value.Mode)} options={scoringModes()} onValueChange={mode => update({Mode: Number(mode) as ManageScoringInput["Mode"], MinPoints: value.MinPoints || 100, MaxPoints: value.MaxPoints || 500, FloorAtPercent: value.FloorAtPercent || 50})} disabled={!canManage || saving} /></div>
            {modeProblem && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{modeProblem}</p>}
            {dynamic && <div className={value.Mode === 3 ? "event-manage-fields-two" : "event-manage-fields-three"}>
                <div className="event-manage-field"><ManageFieldLabel htmlFor="score-min" title={t("manage.scoring.min")} help={t("manage.scoring.minHelp")} required /><input id="score-min" className="event-manage-input" type="number" min={1} step={1} value={value.MinPoints} onChange={event => update({MinPoints: Number(event.target.value)})} disabled={!canManage || saving} /></div>
                <div className="event-manage-field"><ManageFieldLabel htmlFor="score-max" title={t("manage.scoring.max")} help={t("manage.scoring.maxHelp")} required /><input id="score-max" className="event-manage-input" type="number" min={value.MinPoints + 1} step={1} value={value.MaxPoints} onChange={event => update({MaxPoints: Number(event.target.value)})} disabled={!canManage || saving} /></div>
                {value.Mode !== 3 && <div className="event-manage-field"><ManageFieldLabel htmlFor="score-floor" title={t("manage.scoring.floor")} help={t("manage.scoring.floorHelp")} required /><input id="score-floor" className="event-manage-input" type="number" min={1} max={100} step={1} value={value.FloorAtPercent} onChange={event => update({FloorAtPercent: Number(event.target.value)})} disabled={!canManage || saving} /></div>}
            </div>}
            {dynamic && !valid && !modeProblem && <p className="event-manage-validation" role="alert">{t(value.Mode === 3 ? "manage.scoring.invalidTime" : "manage.scoring.invalid")}</p>}
        </section>
        <section className="event-manage-section"><ManageFieldLabel title={t("manage.scoring.force")} help={t("manage.scoring.forceHelp")} /><label className="event-exercise-editor__check"><input type="checkbox" checked={value.ForceEventScoring} onChange={event => update({ForceEventScoring: event.target.checked})} disabled={!canManage || saving} /> {t("manage.scoring.forceLabel")}</label></section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || !valid}>{t(saving ? "common.saving" : "common.save")}</button></div>}
    </form>;
}
