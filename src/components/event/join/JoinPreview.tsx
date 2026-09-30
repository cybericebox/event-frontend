"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers} from "@/api/participantForm";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventBanner} from "@/components/event/EventBanner";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {collectFormAnswers, ParticipantFormFields} from "@/components/event/ParticipantFormFields";
import {NoTeam} from "@/components/event/participation/NoTeam";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {defaultOutcome, joinOutcomes, nextStep, type JoinOutcome, type JoinPreviewStep} from "./joinPreviewModel";

// What a participant sees on /join and after it, played for the organizer. State lives in
// this component only; the form definition is read (GET), nothing is ever written.
export function JoinPreview({event}: {event: PublicEventInfo}) {
    const [step, setStep] = useState<JoinPreviewStep>("form");
    const [outcome, setOutcome] = useState<JoinOutcome>(() => defaultOutcome(event.Registration));
    const [answers, setAnswers] = useState<ParticipantAnswers>({});
    const [error, setError] = useState("");
    const teamMode = event.Participation === 1;
    const invitation = event.Registration === 0;
    const form = useQuery({queryKey: ["event-management-participant-form", event.EventID], queryFn: () => getManageParticipantForm(event.EventID), retry: false, refetchOnWindowFocus: false});

    const advance = () => setStep(current => nextStep(current, {outcome, teamMode}));
    const submit = () => {
        const collected = collectFormAnswers(form.data, answers);
        if (collected.error) { setError(collected.error); return; }
        setError("");
        advance();
    };
    const restart = () => { setStep("form"); setAnswers({}); setError(""); };

    const banner = <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("joinPreview.bannerTitle")} message={t("joinPreview.bannerMessage")}
        action={<div className="ib-seg ib-seg--sm" role="group" aria-label={t("joinPreview.outcome")}>{joinOutcomes.map(option =>
            <button key={option} type="button" aria-pressed={outcome === option} onClick={() => setOutcome(option)}>{t(`joinPreview.outcome.${option}`)}</button>)}</div>} /></div>;

    return <div className="event-join-page"><div className="event-join-card">
        <Link className="event-join-back" href="/">{t("common.backHomeArrow")}</Link>
        {banner}
        {step === "form" && <>
            <h1>{t("join.title")}</h1>
            {form.isPending ? <EventLoading event={event} label={t("join.loading")} />
                : form.isError ? <EventLoadError message={t("join.loadFailed")} error={form.error} onRetry={() => void form.refetch()} />
                : <>
                    {invitation && <p>{t("invite.acceptHint")}</p>}
                    {form.data?.Enabled && <ParticipantFormFields form={form.data} answers={answers} onChange={setAnswers} />}
                    {error && <p className="event-join-error" role="alert">{error}</p>}
                    <EventButton className="ib-btn ib-btn--primary" type="button" onClick={submit}>{invitation ? t("invite.accept") : t("shell.join.action")}</EventButton>
                </>}
        </>}
        {step === "result" && <div className="event-join-result">
            <h2>{t(`joinPreview.result.${outcome}.title`)}</h2>
            <p>{t(`joinPreview.result.${outcome}.text`)}</p>
            <div className="event-join-result__acts"><EventButton className="ib-btn ib-btn--primary" type="button" onClick={advance}>{t("common.next")}</EventButton></div>
        </div>}
        {step === "team" && <div className="event-join-preview__team">
            <h1>{t("joinPreview.team.title")}</h1>
            <p>{t("joinPreview.team.text")}</p>
            <NoTeam event={event} rosterOpen closedReason="" linkCode="" preview />
            <div className="event-join-result__acts"><EventButton className="ib-btn ib-btn--primary" type="button" onClick={advance}>{t("common.next")}</EventButton></div>
        </div>}
        {step === "done" && <div className="event-join-result">
            <h2>{t("joinPreview.done.title")}</h2>
            <p>{outcome === "approved" ? t("joinPreview.done.approved") : t("joinPreview.done.waiting")}</p>
            <div className="event-join-result__acts">
                <Link className="ib-btn ib-btn--primary" href="/participation">{t("joinPreview.openParticipation")}</Link>
                <button type="button" className="ib-btn" onClick={restart}>{t("joinPreview.restart")}</button>
            </div>
        </div>}
    </div></div>;
}
