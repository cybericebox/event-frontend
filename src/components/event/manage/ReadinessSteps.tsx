"use client";

import Link from "next/link";
import {ArrowUpRight, CalendarDays, Check, FileText, UsersRound} from "lucide-react";
import type {ManageConfig, ManageLifecycle} from "@/api/manage";
import {t} from "@/i18n/t";

// The readiness checklist of an event that is being set up: participation
// format, schedule, and the landing page as the next step. Shown on the setup
// page and, until the event starts, on the «Огляд» dashboard.
export function ReadinessSteps({config, lifecycle}: {config: ManageConfig; lifecycle: ManageLifecycle}) {
    return (
        <div className="event-manage-setup__steps" aria-label={t("manage.overview.steps")}>
            <div className={`event-manage-setup__step${config.Participation === null ? " is-current" : " is-complete"}`}><span className="event-manage-setup__step-number">01</span><UsersRound size={20} /><div><strong>{t("manage.overview.participation")}</strong><span>{config.Participation === null ? t("manage.overview.participationPending") : config.Participation === 1 ? t("manage.overview.participationTeams", {size: config.MaxTeamSize}) : t("manage.overview.individual")}</span></div>{config.Participation !== null && <Check size={18} />}</div>
            <div className={`event-manage-setup__step${lifecycle.Configured ? " is-complete" : config.Participation !== null ? " is-current" : ""}`}><span className="event-manage-setup__step-number">02</span><CalendarDays size={20} /><div><strong>{t("manage.overview.schedule")}</strong><span>{t(lifecycle.Configured ? "manage.overview.scheduleSaved" : "manage.overview.schedulePending")}</span></div>{lifecycle.Configured && <Check size={18} />}</div>
            <Link className="event-manage-setup__step" href="/manage/content/landing"><span className="event-manage-setup__step-number">→</span><FileText size={20} /><div><strong>{t("manage.overview.landing")}</strong><span>{t("manage.overview.landingNext")}</span></div><ArrowUpRight size={18} /></Link>
        </div>
    );
}
