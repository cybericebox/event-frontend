"use client";

import {CircleHelp} from "lucide-react";
import type {AnalyticsFunnels as Funnels} from "@/api/manageAnalyticsPeople";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {formatCount, formatDuration} from "./analyticsFormat";
import {formatRate} from "./peopleModel";
import "./analytics.css";

type FunnelCard = {
    key: string;
    title: string;
    hint: string;
    stages: Array<{label: string; value: number}>;
    rate: number | null;
    extra?: string[];
    median: number | null;
};

// The three cards of «Комунікації»: stage counts, the conversion and the
// median time. A missing rate or median is «—», never a zero.
export function funnelCards(funnels: Funnels): FunnelCard[] {
    const {Invitations: invitations, Registration: registration, Applications: applications} = funnels;
    return [
        {
            key: "invitations", title: t("manage.analytics.funnels.invitations.title"), hint: t("manage.analytics.funnels.invitations.hint"),
            stages: [{label: t("manage.analytics.funnels.invitations.sent"), value: invitations.Sent}, {label: t("manage.analytics.funnels.invitations.accepted"), value: invitations.Accepted}],
            rate: invitations.AcceptRate, median: invitations.MedianAcceptSeconds,
        },
        {
            key: "registration", title: t("manage.analytics.funnels.registration.title"), hint: t("manage.analytics.funnels.registration.hint"),
            stages: [{label: t("manage.analytics.funnels.registration.started"), value: registration.Started}, {label: t("manage.analytics.funnels.registration.completed"), value: registration.Completed}],
            rate: registration.CompletionRate, median: null,
        },
        {
            key: "applications", title: t("manage.analytics.funnels.applications.title"), hint: t("manage.analytics.funnels.applications.hint"),
            stages: [{label: t("manage.analytics.funnels.applications.submitted"), value: applications.Submitted}, {label: t("manage.analytics.funnels.applications.decided"), value: applications.Decided}],
            rate: applications.DecidedRate,
            extra: [t("manage.analytics.funnels.applications.approved", {rate: formatRate(applications.ApprovedRate)}), t("manage.analytics.funnels.applications.rejected", {rate: formatRate(applications.RejectedRate)})],
            median: applications.MedianDecisionSeconds,
        },
    ];
}

export function AnalyticsFunnels({funnels}: {funnels: Funnels}) {
    return <section className="event-analytics-stats" aria-label={t("manage.analytics.funnels.label")}>
        {funnelCards(funnels).map(card => <div key={card.key} className="event-analytics-stat event-analytics-funnel" data-testid={`funnel-${card.key}`}>
            <div className="event-analytics-stat__label">
                <span>{card.title}</span>
                <EventTooltip content={card.hint}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title: card.title})} aria-describedby={id}><CircleHelp size={14} /></button>}</EventTooltip>
            </div>
            <strong className="event-analytics-stat__value">{formatRate(card.rate)}</strong>
            <dl className="event-analytics-funnel__stages">
                {card.stages.map(stage => <div key={stage.label}><dt>{stage.label}</dt><dd>{formatCount(stage.value)}</dd></div>)}
            </dl>
            {card.extra?.map(line => <small key={line} className="event-analytics-stat__note">{line}</small>)}
            {card.key !== "registration" && <small className="event-analytics-stat__note">{t("manage.analytics.funnels.median", {time: formatDuration(card.median)})}</small>}
        </div>)}
    </section>;
}
