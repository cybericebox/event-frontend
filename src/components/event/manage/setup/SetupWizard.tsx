"use client";

import Link from "next/link";
import {ArrowUpRight, Bell, CalendarDays, Check, FileText, Gauge, Layers3, Rocket, Server, SlidersHorizontal, Trophy, TriangleAlert, UserRound, UsersRound, type LucideIcon} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {getManageConfig, getManageLifecycle} from "@/api/manage";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {ChallengeBlockers} from "@/components/event/manage/exercises/ChallengeBlockers";
import {useManager} from "@/components/event/manage/ManagerShell";
import {t} from "@/i18n/t";
import type {SetupStepID} from "./setupModel";
import {useSetup} from "./useSetup";
import "./setup.css";

const icons: Record<SetupStepID, LucideIcon> = {
    participation: UsersRound, registration: UserRound, schedule: CalendarDays, challenges: Layers3, scoring: SlidersHorizontal,
    pages: FileText, mail: Bell, results: Trophy, resources: Gauge, stands: Server, publish: Rocket,
};

// «Підготовка заходу»: the step-by-step checklist to run the event. Always
// available, also after the setup, as the list of what is set and what is not.
export function SetupWizard() {
    const {event} = useManager();
    const eventID = event.EventID;
    const setup = useSetup(eventID, true);
    // The queries behind the wizard; a failed base read must not look like a load.
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const lifecycle = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});

    if (config.isError || lifecycle.isError) return <div className="event-manage-setup"><EventLoadError message={t("manage.overview.loadError")} error={config.error ?? lifecycle.error} onRetry={() => { void config.refetch(); void lifecycle.refetch(); }} /></div>;
    if (!setup) return <EventLoading event={event} label={t("manage.overview.loading")} />;

    const {steps, summary} = setup;
    const percent = summary.total === 0 ? 0 : Math.round(summary.done / summary.total * 100);
    const state = summary.complete ? "complete" : summary.blocked ? "blocked" : "progress";
    return <div className="event-manage-setup event-setup">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">{t("manage.overview.eyebrow")}</p><h1>{t("manage.setup.title")}</h1><p>{t("manage.setup.intro")}</p></div><Link className="ib-btn" href="/">{t("manage.overview.viewSite")} <ArrowUpRight size={16} /></Link></header>
        <ChallengeBlockers eventID={eventID} />
        <div className="event-manage-setup__summary" role="status">
            <div><span className="event-manage-setup__summary-label">{t("manage.setup.summary.label")}</span><strong>{t(`manage.setup.summary.${state}`)}</strong><p>{t(`manage.setup.summary.${state}Text`)}</p></div>
            <div className="event-manage-setup__summary-progress"><b>{summary.done}<span>/{summary.total}</span></b><span>{t("manage.overview.requiredSteps")}</span><div className="event-manage-setup__progress-track"><span style={{width: `${percent}%`}} /></div></div>
        </div>
        <ol className="event-setup__list" aria-label={t("manage.overview.steps")}>
            {steps.map((step, index) => {
                const Icon = icons[step.id];
                return <li className={`event-setup__row is-${step.status}`} key={step.id}>
                    <span className="event-setup__number">{step.status === "done" ? <Check size={14} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span>
                    <Icon className="event-setup__icon" size={18} aria-hidden="true" />
                    <div className="event-setup__body"><strong>{t(`manage.setup.step.${step.id}`)}</strong><span>{t(`manage.setup.detail.${step.detail}`, step.vars)}</span>{step.warning && <span className="event-setup__warning" role="note"><TriangleAlert size={14} aria-hidden="true" />{t(`manage.setup.detail.${step.warning.detail}`, step.warning.vars)}</span>}</div>
                    <span className={`event-setup__status is-${step.status}`}>{t(`manage.setup.status.${step.status}`)}</span>
                    <Link className="ib-btn" href={step.href}>{t(step.status === "done" || step.status === "optional" || step.status === "review" ? "manage.setup.open" : "manage.setup.fix")}</Link>
                </li>;
            })}
        </ol>
    </div>;
}
