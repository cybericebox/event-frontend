"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers} from "@/api/participantForm";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {collectFormAnswers, ParticipantFormFields} from "@/components/event/ParticipantFormFields";
import {NoTeam} from "@/components/event/participation/NoTeam";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {JoinResultCard} from "./JoinResultCard";
import {useParticipantPreview, participantPreviewForm} from "../ParticipantPreview";
import {type JoinPreviewStep} from "./joinPreviewModel";

// What a participant sees on /join and after it, played for the organizer. State lives in
// this component only; the form definition is read (GET), nothing is ever written.
export function JoinPreview({event}: {event: PublicEventInfo}) {
    const preview = useParticipantPreview(event.EventID);
    const [step, setStep] = useState<JoinPreviewStep>(() => preview.state?.status ? "result" : "form");
    const outcome = preview.state?.outcome ?? (event.Registration === 1 ? "pending" : "approved");
    const [answers, setAnswers] = useState<ParticipantAnswers>({});
    const [error, setError] = useState("");
    const teamMode = event.Participation === 1;
    const invitation = event.Registration === 0;
    const form = useQuery({queryKey: ["event-management-participant-form", event.EventID], queryFn: () => getManageParticipantForm(event.EventID), select: participantPreviewForm, retry: false, refetchOnWindowFocus: false});

    const advance = () => setStep(current => current === "result" && teamMode && outcome === "approved" && !preview.state?.team ? "team" : "done");
    const submit = () => {
        const collected = collectFormAnswers(form.data, answers);
        if (collected.error) { setError(collected.error); return; }
        setError("");
        preview.update({status: outcome === "approved" ? 2 : outcome === "pending" ? 1 : 3, answers: collected.answers});
        setStep("result");
    };


    return <div className="event-join-page"><div className="event-join-card">
        <Link className="event-join-back" href="/">{t("common.backHomeArrow")}</Link>
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
        {step === "result" && <JoinResultCard outcome={outcome} title={t(`joinPreview.result.${outcome}.title`)} text={t(`joinPreview.result.${outcome}.text`)}
            action={<EventButton className="ib-btn ib-btn--primary" type="button" onClick={advance}>{t("common.next")}</EventButton>} />}
        {step === "team" && <div className="event-join-preview__team">
            <h1>{t("joinPreview.team.title")}</h1>
            <p>{t("joinPreview.team.text")}</p>
            {preview.state?.team ? <JoinResultCard outcome="approved" title={preview.state.team.Name} text={t("participantPreview.teamCreated")} /> : <NoTeam event={event} rosterOpen closedReason="" linkCode="" preview />}
            <div className="event-join-result__acts"><EventButton className="ib-btn ib-btn--primary" type="button" disabled={!preview.state?.team} onClick={advance}>{t("common.next")}</EventButton></div>
        </div>}
        {step === "done" && <div className="event-join-result">
            <h2>{t(`joinPreview.result.${outcome}.title`)}</h2>
            <div className="event-join-result__acts">
                <Link className="ib-btn ib-btn--primary" href="/participation">{t("joinPreview.openParticipation")}</Link>
            </div>
        </div>}
    </div></div>;
}
