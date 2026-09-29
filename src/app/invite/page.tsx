"use client";

import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ApiErrorCode, apiErrorMessage} from "@/api/apiErrors";
import {getCurrentUser, getInvitationInfo} from "@/api/clientAuth";
import {acceptSelfInvitation, declineSelfInvitation, getSelfParticipantForm, ParticipantJoinError, submitSelfParticipantForm, type ParticipantAnswers} from "@/api/participantForm";
import {collectFormAnswers, ParticipantFormFields} from "@/components/event/ParticipantFormFields";
import {ParticipationStatusEnum} from "@/types/event";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {eventOrigin, idOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";
import {EventButton} from "@/components/ui/EventButton";

function signInHref(eventTag: string | undefined): string | null {
    const back = eventTag ? eventOrigin(eventTag) : "";
    return idOrigin && back ? `${idOrigin}/sign-in?return_to=${encodeURIComponent(`${back}/invite`)}` : null;
}

export default function InvitePage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const guestEvent = useGuestEvent();
    const participant = useParticipantContext();
    const event = guestEvent ?? participant?.event;
    const identity = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false});
    const info = useQuery({queryKey: ["event-invitation-status", event?.EventID], queryFn: getInvitationInfo, enabled: !!identity.data && !!event, retry: false});
    const invitation = info.data;
    const actionable = !!invitation && invitation.Invited && invitation.Status === ParticipationStatusEnum.PendingParticipationStatus && !invitation.InvitationExpired && !invitation.TeamUnavailable;
    const form = useQuery({queryKey: ["event-participant-form", event?.EventID], queryFn: () => getSelfParticipantForm(), enabled: !!event && actionable, retry: false});
    const [answers, setAnswers] = useState<ParticipantAnswers>({});
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [expired, setExpired] = useState(false);

    async function refreshStatus(status: number) {
        if (!event) return;
        queryClient.setQueryData(["event-join-status", event.EventID], status);
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["event-invitation-status", event.EventID]}),
            queryClient.invalidateQueries({queryKey: ["event-participant-info", event.EventID]}),
            queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]}),
        ]);
    }

    async function accept() {
        if (!event || working || !actionable || form.isPending || form.isError) return;
        setError("");
        const collected = collectFormAnswers(form.data, answers);
        if (collected.error) {
            setError(collected.error);
            return;
        }
        setWorking(true);
        try {
            if (collected.send) await submitSelfParticipantForm(event.EventID, collected.answers);
            const result = await acceptSelfInvitation();
            await refreshStatus(result.Status);
            router.push(Date.parse(event.StartTime) <= Date.now() ? "/challenges" : "/");
        } catch (failure) {
            const code = failure instanceof ParticipantJoinError ? failure.code : undefined;
            if (code === ApiErrorCode.InvitationExpired) setExpired(true);
            setError(apiErrorMessage(code, t("invite.acceptFailed")));
        } finally {setWorking(false);}
    }

    async function decline() {
        if (!event || working || !window.confirm(t("invite.declineConfirm"))) return;
        setError("");
        setWorking(true);
        try {
            await declineSelfInvitation();
            await refreshStatus(ParticipationStatusEnum.NoParticipationStatus);
            router.push("/");
        } catch (failure) {
            setError(apiErrorMessage(failure instanceof ParticipantJoinError ? failure.code : undefined, t("invite.declineFailed")));
        } finally {setWorking(false);}
    }

    const home = <Link className="ib-btn" href="/">{t("common.home")}</Link>;
    const signIn = signInHref(event?.Tag);
    const title = invitation?.InvitedTeamName ? t("invite.titleTeam", {team: invitation.InvitedTeamName}) : t("invite.titleEvent", {name: event?.Name ?? ""});
    return <div className="event-join-page"><div className="event-join-card">
        <Link className="event-join-back" href="/">{t("common.backHomeArrow")}</Link>
        {!event || identity.isPending || (identity.data && (info.isPending || (actionable && form.isPending))) ? <><h1>{t("invite.title")}</h1><EventLoading event={event} label={t("invite.loading")} /></>
            : identity.isError || info.isError || (actionable && form.isError) ? <><h1>{t("invite.title")}</h1><div role="alert"><p>{t("invite.loadFailed")}</p><button className="ib-btn" type="button" onClick={() => void (identity.isError ? identity.refetch() : info.isError ? info.refetch() : form.refetch())}>{t("common.retry")}</button></div></>
            : !identity.data ? <><h1>{t("invite.title")}</h1><p>{t("invite.signInHint")}</p>{signIn ? <a className="ib-btn ib-btn--primary" href={signIn}>{t("account.signIn")}</a> : <p>{t("invite.signInTop")}</p>}</>
            : invitation?.Status === ParticipationStatusEnum.ApprovedParticipationStatus ? <><h1>{t("invite.alreadyTitle")}</h1><p>{t("invite.already")}</p>{home}</>
            : !invitation?.Invited || invitation.Status !== ParticipationStatusEnum.PendingParticipationStatus ? <><h1>{t("invite.notFoundTitle")}</h1><p>{t("invite.notFound")}</p>{home}</>
            : invitation.InvitationExpired || expired ? <><h1>{title}</h1><p role="status">{t("shell.invite.expired")}</p>{home}</>
            : invitation.TeamUnavailable ? <><h1>{t("invite.title")}</h1><p role="status">{t("invite.teamUnavailable")}</p>{home}</>
            : <>
                <h1>{title}</h1>
                <p>{invitation.InvitedTeamName ? t("invite.acceptHintTeam") : t("invite.acceptHint")}</p>
                {form.data?.Enabled && <ParticipantFormFields form={form.data} answers={answers} onChange={setAnswers} idPrefix="invite" />}
                {error && <p className="event-join-error" role="alert">{error}</p>}
                <div className="event-join-actions"><EventButton className="ib-btn ib-btn--primary" type="button" disabled={working} onClick={() => void accept()} busy={working}>{t("invite.accept")}</EventButton><button className="ib-btn" type="button" disabled={working} onClick={() => void decline()}>{t("invite.decline")}</button></div>
            </>}
    </div></div>;
}
