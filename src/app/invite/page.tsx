"use client";

import {useMemo, useRef, useState} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ApiErrorCode, apiErrorMessage} from "@/api/apiErrors";
import {getCurrentUser, getInvitationInfo} from "@/api/clientAuth";
import {acceptSelfInvitation, declineSelfInvitation, getSelfParticipantForm, ParticipantJoinError, submitSelfParticipantForm, type ParticipantAnswers} from "@/api/participantForm";
import {collectFormAnswers, lockedFieldKeys, ParticipantFormFields} from "@/components/event/ParticipantFormFields";
import {ParticipationStatusEnum} from "@/types/event";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {t} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";
import {SignInRedirect} from "@/components/event/SignInRedirect";
import {EventButton} from "@/components/ui/EventButton";
import {EmptyState} from "@/components/ui/EmptyState";
import {JoinResultCard} from "@/components/event/join/JoinResultCard";
import {focusFirstInvalid} from "@/components/event/FormQuestion";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";

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
    // Answers an organizer prefilled (CSV import) show up first; the person's own edits win, except locked ones.
    const [edits, setAnswers] = useState<ParticipantAnswers>({});
    const stored = form.data?.Answers;
    const locked = useMemo(() => lockedFieldKeys(form.data, stored), [form.data, stored]);
    const answers = useMemo(() => ({...stored, ...edits}), [stored, edits]);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    const [expired, setExpired] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [declineError, setDeclineError] = useState("");

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
        setFieldErrors({});
        const collected = collectFormAnswers(form.data, answers);
        if (collected.error) {
            if (collected.errorKey) {
                setFieldErrors({[collected.errorKey]: collected.error});
                requestAnimationFrame(() => focusFirstInvalid(formRef.current));
            } else setError(collected.error);
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
        if (!event || working) return;
        setError("");
        setWorking(true);
        try {
            await declineSelfInvitation();
            await refreshStatus(ParticipationStatusEnum.NoParticipationStatus);
            router.push("/");
        } catch (failure) {
            setDeclineError(apiErrorMessage(failure instanceof ParticipantJoinError ? failure.code : undefined, t("invite.declineFailed")));
        } finally {setWorking(false);}
    }

    const home = <Link className="ib-btn" href="/">{t("common.home")}</Link>;
    const title = invitation?.InvitedTeamName ? t("invite.titleTeam", {team: invitation.InvitedTeamName}) : t("invite.titleEvent", {name: event?.Name ?? ""});
    return <div className="event-join-page"><div className="event-join-card">
        <Link className="event-join-back" href="/">{t("common.backHomeArrow")}</Link>
        {!event || identity.isPending || (identity.data && (info.isPending || (actionable && form.isPending))) ? <><h1>{t("invite.title")}</h1><EventLoading event={event} label={t("invite.loading")} /></>
            : identity.isError || info.isError || (actionable && form.isError) ? <><h1>{t("invite.title")}</h1><EventLoadError message={t("invite.loadFailed")} error={identity.error ?? info.error ?? form.error} onRetry={() => void (identity.isError ? identity.refetch() : info.isError ? info.refetch() : form.refetch())} /></>
            : !identity.data ? <SignInRedirect event={event} />
            : invitation?.Status === ParticipationStatusEnum.ApprovedParticipationStatus ? <><h1>{t("invite.title")}</h1><JoinResultCard outcome="approved" title={t("invite.alreadyTitle")} text={t("invite.already")} action={home} /></>
            : !invitation?.Invited || invitation.Status !== ParticipationStatusEnum.PendingParticipationStatus ? <><h1>{t("invite.title")}</h1><EmptyState message={t("invite.notFound")} action={home} /></>
            : invitation.InvitationExpired || expired ? <><h1>{t("invite.title")}</h1><EmptyState message={t("shell.invite.expired")} action={home} /></>
            : invitation.TeamUnavailable ? <><h1>{t("invite.title")}</h1><EmptyState message={t("invite.teamUnavailable")} action={home} /></>
            : <form ref={formRef} className="ib-form" noValidate onSubmit={event => {event.preventDefault(); void accept();}}>
                <h1>{title}</h1>
                <p>{invitation.InvitedTeamName ? t("invite.acceptHintTeam") : t("invite.acceptHint")}</p>
                {form.data?.Enabled && <ParticipantFormFields form={form.data} answers={answers} onChange={setAnswers} idPrefix="invite" locked={locked} errors={fieldErrors} />}
                {error && <p className="ib-form__error" role="alert">{error}</p>}
                <div className="event-join-actions"><EventButton className="ib-btn ib-btn--primary" type="submit" busy={working}>{t("invite.accept")}</EventButton><button className="ib-btn" type="button" disabled={working} onClick={() => {setDeclineError(""); setDeclining(true);}}>{t("invite.decline")}</button></div>
                <ConfirmDialog open={declining} onCancel={() => setDeclining(false)} tone="danger" busy={working} error={declineError}
                    title={t("invite.declineTitle")} description={t("invite.declineBody")} confirmLabel={t("invite.decline")} onConfirm={() => void decline()} />
            </form>}
    </div></div>;
}
