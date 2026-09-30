"use client";

import {useEffect, useState} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {apiErrorMessage} from "@/api/apiErrors";
import {getCurrentUser, getInvitationInfo, getJoinStatus} from "@/api/clientAuth";
import {getSelfParticipantForm, joinSelfEvent, ParticipantJoinError, submitSelfParticipantForm, type ParticipantAnswers} from "@/api/participantForm";
import {reasonText, useParticipation} from "@/components/event/participation/participationRules";
import {collectFormAnswers, ParticipantFormFields} from "@/components/event/ParticipantFormFields";
import {ParticipationStatusEnum} from "@/types/event";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {t} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";
import {SignInRedirect} from "@/components/event/SignInRedirect";
import {EventButton} from "@/components/ui/EventButton";

export default function JoinPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const guestEvent = useGuestEvent();
    const participant = useParticipantContext();
    const event = guestEvent ?? participant?.event;
    const identity = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false});
    const join = useQuery({queryKey: ["event-join-status", event?.EventID], queryFn: getJoinStatus, enabled: !!identity.data && !!event, retry: false});
    const invitation = useQuery({queryKey: ["event-invitation-status", event?.EventID], queryFn: getInvitationInfo, enabled: !!identity.data && !!event && join.data === 1, retry: false});
    // Invitations are accepted on /invite; this page only handles own applications.
    const invited = invitation.data?.Invited === true && invitation.data.Status === ParticipationStatusEnum.PendingParticipationStatus;
    // What the caller may do is decided by the server (schedule, registration
    // mode, staff role); the page only shows it and the reason when it is closed.
    const registration = useParticipation(event?.EventID, !!identity.data && !!event);
    const register = registration.data?.Register;
    const canJoin = join.data === 0 && !!register?.Allowed;
    const form = useQuery({queryKey: ["event-participant-form", event?.EventID], queryFn: () => getSelfParticipantForm(), enabled: !!identity.data && !!event && canJoin, retry: false});
    const [answers, setAnswers] = useState<ParticipantAnswers>({});
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {if (invited) router.replace("/invite");}, [invited, router]);

    async function submit() {
        if (!event || working || !identity.data || !canJoin || form.isPending || form.isError) return;
        setError("");
        const collected = collectFormAnswers(form.data, answers);
        if (collected.error) {
            setError(collected.error);
            return;
        }
        setWorking(true);
        try {
            if (collected.send) await submitSelfParticipantForm(event.EventID, collected.answers);
            const status = await joinSelfEvent();
            queryClient.setQueryData(["event-join-status", event.EventID], status);
            if (status === ParticipationStatusEnum.ApprovedParticipationStatus) {
                void queryClient.invalidateQueries({queryKey: ["event-participant-info", event.EventID]});
                void queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]});
            }
            router.push("/");
        } catch (failure) {
            setError(apiErrorMessage(failure instanceof ParticipantJoinError ? failure.code : undefined, t("join.failed")));
        } finally {setWorking(false);}
    }

    const status = join.data;
    return <div className="event-join-page"><div className="event-join-card">
        <Link className="event-join-back" href="/">{t("common.backHomeArrow")}</Link>
        <h1>{t("join.title")}</h1>
        {!event || identity.isPending || (identity.data && (join.isPending || registration.isPending || (status === 1 && invitation.isPending) || (canJoin && form.isPending))) || invited ? <EventLoading event={event} label={t("join.loading")} />
            : identity.isError || join.isError || registration.isError || invitation.isError || (canJoin && form.isError) ? <EventLoadError message={t("join.loadFailed")} error={identity.error ?? join.error ?? registration.error ?? invitation.error ?? form.error} onRetry={() => void (identity.isError ? identity.refetch() : join.isError ? join.refetch() : registration.isError ? registration.refetch() : invitation.isError ? invitation.refetch() : form.refetch())} />
            : !identity.data ? <SignInRedirect event={event} full={false} />
            : status === ParticipationStatusEnum.ApprovedParticipationStatus ? <p>{t("invite.already")}</p>
            : status === ParticipationStatusEnum.PendingParticipationStatus ? <p>{t("join.pending")}</p>
            : status === ParticipationStatusEnum.RejectedParticipationStatus ? <p>{t("shell.join.rejected")}</p>
            : !register?.Allowed ? <p>{reasonText(register?.Reason ?? "") || t("join.closed")}</p>
            : <>
                {form.data?.Enabled && <ParticipantFormFields form={form.data} answers={answers} onChange={setAnswers} />}
                {error && <p className="event-join-error" role="alert">{error}</p>}
                <EventButton className="ib-btn ib-btn--primary" type="button" disabled={working} onClick={() => void submit()} busy={working}>{t("shell.join.action")}</EventButton>
            </>}
    </div></div>;
}
