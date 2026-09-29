"use client";

import {useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, CalendarDays, Check, FileText, UsersRound} from "lucide-react";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageConfig, putManageLifecycle, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ChallengeBlockers} from "@/components/event/manage/exercises/ChallengeBlockers";
import {ManageDateField} from "@/components/event/manage/ManageDateField";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";

function localDateTime(iso: string | null): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function ManageIndex() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const client = useQueryClient();
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchInterval: false, refetchOnWindowFocus: false});
    const lifecycle = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchInterval: false, refetchOnWindowFocus: false});
    const [registrationDraft, setRegistrationDraft] = useState<0 | 1 | 2 | null>(null);
    const [publishAtDraft, setPublishAtDraft] = useState<string | null>(null);
    const [startAtDraft, setStartAtDraft] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    if (config.isPending || lifecycle.isPending) return <EventLoading event={event} label={t("manage.overview.loading")} />;
    if (config.isError || lifecycle.isError) return <EventLoadError message={t("manage.overview.loadError")} onRetry={() => { void config.refetch(); void lifecycle.refetch(); }} />;

    const participation = config.data.Participation;
    const registration = registrationDraft ?? config.data.Registration;
    const publishAt = publishAtDraft ?? localDateTime(lifecycle.data.PublishAt);
    const startAt = startAtDraft ?? localDateTime(lifecycle.data.StartAt);
    const joinPolicy = lifecycle.data.JoinPolicy;
    const configured = config.data.Participation !== null && lifecycle.data.Configured;
    const completedSteps = Number(config.data.Participation !== null) + Number(lifecycle.data.Configured);
    const publishTime = Date.parse(publishAt);
    const startTime = Date.parse(startAt);
    const valid = participation !== null && Number.isFinite(publishTime) && Number.isFinite(startTime) && startTime >= publishTime;

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canManage || !valid || saving || participation === null) return;
        setSaving(true);
        setError("");
        try {
            const current = config.data!;
            if (current.Registration !== registration) {
                const input: ManageConfigInput = {
                    Participation: participation, Registration: registration,
                    ScoreboardVisibility: current.ScoreboardVisibility, ParticipantsVisibility: current.ParticipantsVisibility,
                    PreviewDescription: current.PreviewDescription, PreviewPicture: current.PreviewPicture,
                    MaxTeamSize: current.MaxTeamSize,
                    MinTeamSize: current.MinTeamSize,
                    MaxTeams: current.MaxTeams,
                    AllowPseudonyms: current.AllowPseudonyms,
                    ShowDifficulty: current.ShowDifficulty, HintsDisabled: current.HintsDisabled, HintChargeMode: current.HintChargeMode,
                };
                client.setQueryData(["event-management-config", eventID], await putManageConfig(eventID, input));
            }
            client.setQueryData(["event-management-lifecycle", eventID], await putManageLifecycle(eventID, {
                JoinPolicy: joinPolicy, PublishAt: new Date(publishTime).toISOString(),
                StartAt: new Date(startTime).toISOString(), FinishAt: null, WithdrawAt: null,
            }));
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            setError(t(status === 409 ? "manage.overview.conflict" : status === 400 ? "manage.overview.scheduleRejected" : "manage.overview.saveError"));
        } finally { setSaving(false); }
    }

    return <div className="event-manage-setup">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">{t("manage.overview.eyebrow")}</p><h1>{t("manage.overview.title")}</h1><p>{t(configured ? "manage.overview.introReady" : "manage.overview.introSetup")}</p></div><Link className="ib-btn" href="/">{t("manage.overview.viewSite")} <ArrowUpRight size={16} /></Link></header>
        <ChallengeBlockers eventID={eventID} />
        <div className="event-manage-setup__summary" role="status">
            <div><span className="event-manage-setup__summary-label">{t("manage.overview.firstRun")}</span><strong>{t(configured ? "manage.overview.summaryReady" : "manage.overview.summarySetup")}</strong><p>{t(configured ? "manage.overview.summaryReadyText" : "manage.overview.summarySetupText")}</p></div>
            <div className="event-manage-setup__summary-progress"><b>{completedSteps}<span>/2</span></b><span>{t("manage.overview.requiredSteps")}</span><div className="event-manage-setup__progress-track"><span style={{width: `${completedSteps * 50}%`}} /></div></div>
        </div>
        <div className="event-manage-setup__steps" aria-label={t("manage.overview.steps")}>
            <div className={`event-manage-setup__step${config.data.Participation === null ? " is-current" : " is-complete"}`}><span className="event-manage-setup__step-number">01</span><UsersRound size={20} /><div><strong>{t("manage.overview.participation")}</strong><span>{config.data.Participation === null ? t("manage.overview.participationPending") : config.data.Participation === 1 ? t("manage.overview.participationTeams", {size: config.data.MaxTeamSize}) : t("manage.overview.individual")}</span></div>{config.data.Participation !== null && <Check size={18} />}</div>
            <div className={`event-manage-setup__step${lifecycle.data.Configured ? " is-complete" : config.data.Participation !== null ? " is-current" : ""}`}><span className="event-manage-setup__step-number">02</span><CalendarDays size={20} /><div><strong>{t("manage.overview.schedule")}</strong><span>{t(lifecycle.data.Configured ? "manage.overview.scheduleSaved" : "manage.overview.schedulePending")}</span></div>{lifecycle.data.Configured && <Check size={18} />}</div>
            <Link className="event-manage-setup__step" href="/manage/content/landing"><span className="event-manage-setup__step-number">→</span><FileText size={20} /><div><strong>{t("manage.overview.landing")}</strong><span>{t("manage.overview.landingNext")}</span></div><ArrowUpRight size={18} /></Link>
        </div>
        {!configured && <form className="event-manage-section event-manage-setup__form" onSubmit={save}>
            <div className="event-manage-section__head"><h2>{t("manage.overview.requiredTitle")}</h2><p>{t("manage.overview.requiredIntro")}</p></div>
            <dl className="event-manage-setup__facts">
                <div><dt>{t("manage.overview.participation")}</dt><dd>{participation === null ? t("manage.overview.participationPending") : participation === 1 ? t("manage.overview.participationTeams", {size: config.data.MaxTeamSize}) : t("manage.overview.individual")}</dd><Link href="/manage/participation-settings">{t(participation === null ? "manage.overview.choose" : "manage.overview.change")}</Link></div>
                <div><dt>{t("manage.overview.joinPolicy")}</dt><dd>{t(joinPolicy === 1 ? "manage.overview.joinDuringEvent" : "manage.overview.joinBeforeStart")}</dd><Link href="/manage/registration">{t("manage.overview.change")}</Link></div>
            </dl>
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.overview.registration")} help={t("manage.overview.registrationHelp")} required /><EventSelect ariaLabel={t("manage.overview.registration")} value={String(registration)} options={[{value: "0", label: t("manage.overview.registrationClosed")}, {value: "1", label: t("manage.overview.registrationApproval")}, {value: "2", label: t("manage.overview.registrationOpen")}]} onValueChange={value => setRegistrationDraft(Number(value) as 0 | 1 | 2)} disabled={!canManage || saving} /></div>
            <div className="event-manage-fields-two">
                <ManageDateField id="setup-publish-at" title={t("manage.overview.publishAt")} help={t("manage.overview.publishAtHelp")} value={publishAt} onChange={setPublishAtDraft} disabled={!canManage || saving} required />
                <ManageDateField id="setup-start-at" title={t("manage.overview.startAt")} help={t("manage.overview.startAtHelp")} value={startAt} onChange={setStartAtDraft} disabled={!canManage || saving} required />
            </div>
            {error && <p className="event-manage-validation" role="alert">{error}</p>}
            {publishAt && startAt && startTime < publishTime && <p className="event-manage-validation" role="alert">{t("manage.overview.startBeforePublish")}</p>}
            <div className="event-manage-section__actions"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || !valid || saving} busy={saving}>{t("manage.overview.saveAndSchedule")}</EventButton></div>
        </form>}
        {configured && <div className="event-manage-setup__links"><Link className="ib-btn" href="/manage/settings">{t("manage.overview.linkSettings")}</Link><Link className="ib-btn" href="/manage/schedule">{t("manage.overview.linkSchedule")}</Link><Link className="ib-btn ib-btn--primary" href="/manage/content/landing">{t("manage.overview.linkLanding")}</Link></div>}
    </div>;
}
