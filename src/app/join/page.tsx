"use client";

import {useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useEffect, useEffectEvent, useRef, useState} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useDraftRouter as useRouter} from "@/components/event/manage/manualDraft";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {apiErrorText} from "@/api/apiErrors";
import {getCurrentUser, getInvitationInfo, getJoinStatus} from "@/api/clientAuth";
import {getSelfParticipantForm, joinSelfEvent, submitSelfParticipantForm, type ParticipantAnswers} from "@/api/participantForm";
import {reasonText, useParticipation} from "@/components/event/participation/participationRules";
import {collectFormAnswers, ParticipantFormFields} from "@/components/event/ParticipantFormFields";
import {ParticipationStatusEnum} from "@/types/event";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {consumeJoinIntent} from "@/utils/joinIntent";
import {t} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";
import {SignInRedirect} from "@/components/event/SignInRedirect";
import {JoinDialog} from "@/components/event/join/JoinDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EmptyState} from "@/components/ui/EmptyState";
import {focusFirstInvalid} from "@/components/event/FormQuestion";
import {useParticipantPreview} from "@/components/event/ParticipantPreview";
import {JoinPreview} from "@/components/event/join/JoinPreview";
import {useStaffAccess} from "@/components/event/useStaffAccess";

export default function JoinPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const guestEvent = useGuestEvent();
    const participant = useParticipantContext();
    const event = guestEvent ?? participant?.event;
    const preview = useParticipantPreview(event?.EventID);
    const staff = useStaffAccess(event?.EventID);
    const identity = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false});
    const join = useQuery({queryKey: ["event-join-status", event?.EventID], queryFn: getJoinStatus, enabled: !!identity.data && !!event && !preview.active, retry: false,
        // A pending application is decided while the page is open.
        refetchOnWindowFocus: true, refetchInterval: query => query.state.data === ParticipationStatusEnum.PendingParticipationStatus ? 60_000 : false});
    const invitation = useQuery({queryKey: ["event-invitation-status", event?.EventID], queryFn: getInvitationInfo, enabled: !!identity.data && !!event && join.data === 1, retry: false});
    // Invitations are accepted on /invite; this page only handles own applications.
    const invited = invitation.data?.Invited === true && invitation.data.Status === ParticipationStatusEnum.PendingParticipationStatus;
    // What the caller may do is decided by the server (schedule, registration
    // mode, staff role); the page only shows it and the reason when it is closed.
    const registration = useParticipation(event?.EventID, !!identity.data && !!event && !preview.active);
    const register = registration.data?.Register;
    const canJoin = !preview.active && join.data === 0 && !!register?.Allowed;
    const form = useQuery({queryKey: ["event-participant-form", event?.EventID], queryFn: () => getSelfParticipantForm(), enabled: !!identity.data && !!event && canJoin, retry: false});
    const [answers, setAnswers] = useSessionDraftState<ParticipantAnswers>("registration-answers", {});
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    // A click on «Приєднатися» leaves ?continue=<nonce>: a registration without fields is then sent at once.
    const [auto, setAuto] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("continue"));

    useEffect(() => {if (invited) router.replace("/invite");}, [invited, router]);

    // Back from the sign-in that registration asked for (?continue=<nonce>): with no form to fill the
    // application is sent at once; with a form the visitor fills it and presses the button.
    const resumed = useRef(false);
    const resume = useEffectEvent(() => void submit());
    useEffect(() => {
        if (resumed.current || !canJoin || form.isPending || form.isError || form.data?.Enabled) return;
        const params = new URLSearchParams(window.location.search);
        const nonce = params.get("continue");
        if (!nonce || !event) return;
        resumed.current = true;
        params.delete("continue");
        window.history.replaceState(null, "", params.size ? `/join?${params}` : "/join");
        if (consumeJoinIntent(event.EventID, nonce)) resume();
        // eslint-disable-next-line react-hooks/set-state-in-effect -- a forged or stale link must not keep the registering loader
        else setAuto(false);
    }, [canJoin, event, form.isPending, form.isError, form.data]);

    async function submit() {
        if (!event || working || !identity.data || !canJoin || form.isPending || form.isError) return;
        setError("");
        setFieldErrors({});
        const collected = collectFormAnswers(form.data, answers);
        if (collected.error) {
            if (collected.errorKey) {
                setFieldErrors(collected.errors ?? {[collected.errorKey]: collected.error});
                requestAnimationFrame(() => focusFirstInvalid(formRef.current));
            } else setError(collected.error);
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
            setAnswers({});
        } catch (failure) {
            setError(apiErrorText(failure, t("join.failed")));
        } finally {setWorking(false);}
    }

    // Staff cannot join their own event: they walk through the registration as a preview instead.
    if (event && preview.active) return <JoinPreview event={event} />;
    const status = join.data;
    const checking = !event || identity.isPending || staff.pending || (identity.data && (join.isPending || registration.isPending || (status === 1 && invitation.isPending) || (canJoin && form.isPending))) || invited;
    const failed = identity.isError || join.isError || registration.isError || invitation.isError || (canJoin && form.isError);
    const ownTeam = participant?.ownTeam;
    return <JoinDialog outcome={!checking && !failed ? status === 2 ? "approved" : status === 1 ? "pending" : status === 3 ? "rejected" : undefined : undefined} teamMode={event?.Participation === 1} onClose={() => router.push("/")}
        resultText={status === 2 && event?.Participation === 1 && ownTeam ? t("join.result.approved.hasTeam", {name: ownTeam.Name}) : undefined}>
        {checking ? <EventLoading event={event} label={t("join.loading")} />
            : failed ? <EventLoadError message={t("join.loadFailed")} error={identity.error ?? join.error ?? registration.error ?? invitation.error ?? form.error} onRetry={() => void (identity.isError ? identity.refetch() : join.isError ? join.refetch() : registration.isError ? registration.refetch() : invitation.isError ? invitation.refetch() : form.refetch())} />
            : !identity.data ? <SignInRedirect event={event} />
            : !register?.Allowed ? <EmptyState message={reasonText(register?.Reason ?? "") || t("join.closed")} />
            : !form.data?.Enabled && (working || auto) ? <EventLoading event={event} label={t("common.busy.registering")} />
            : <form ref={formRef} className="ib-form" noValidate onSubmit={event => {event.preventDefault(); void submit();}}>
                <p>{t("join.intro", {name: event?.Name ?? ""})}</p>
                {form.data?.Enabled && <ParticipantFormFields form={form.data} answers={answers} onChange={setAnswers} errors={fieldErrors} />}
                {error && <p className="ib-form__error" role="alert">{error}</p>}
                <EventButton className="ib-btn ib-btn--primary" type="submit" busy={working} busyLabel={t("common.busy.submittingApplication")}>{t(form.data?.Enabled ? "join.submit.action" : "join.confirm.action")}</EventButton>
            </form>}
    </JoinDialog>;
}
