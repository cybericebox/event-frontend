"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {apiErrorMessage} from "@/api/apiErrors";
import {getCurrentUser, getInvitationInfo, getJoinStatus, getRegistrationWindow} from "@/api/clientAuth";
import {getSelfParticipantForm, joinSelfEvent, ParticipantJoinError, submitSelfParticipantForm, type ParticipantAnswers} from "@/api/participantForm";
import {registrationWindowOpen} from "@/components/event/content/ActionBlock";
import {collectFormAnswers, ParticipantFormFields} from "@/components/event/ParticipantFormFields";
import {ParticipationStatusEnum} from "@/types/event";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";

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
    const registration = useQuery({queryKey: ["event-registration-window", event?.EventID], queryFn: () => getRegistrationWindow(event!.EventID), enabled: !!identity.data && !!event, retry: false});
    const windowOpen = (now: number) => !!registration.data && registrationWindowOpen(registration.data.registrationOpen, registration.data.joinPolicy, registration.data.startAt, registration.data.finishAt, now);
    const [openedAt] = useState(() => Date.now());
    const canJoin = join.data === 0 && windowOpen(openedAt);
    const form = useQuery({queryKey: ["event-participant-form", event?.EventID], queryFn: () => getSelfParticipantForm(), enabled: !!identity.data && !!event && canJoin, retry: false});
    const [answers, setAnswers] = useState<ParticipantAnswers>({});
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {if (invited) router.replace("/invite");}, [invited, router]);

    async function submit() {
        if (!event || working || !identity.data || !canJoin || form.isPending || form.isError) return;
        setError("");
        if (!windowOpen(Date.now())) {
            setError("Реєстрацію на подію закрито.");
            return;
        }
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
            setError(apiErrorMessage(failure instanceof ParticipantJoinError ? failure.code : undefined, "Не вдалося зберегти додаткові поля або приєднатися. Перевірте відповіді та спробуйте ще раз."));
        } finally {setWorking(false);}
    }

    const status = join.data;
    return <div className="event-join-page"><div className="event-join-card">
        <Link className="event-join-back" href="/">← На головну</Link>
        <h1>Приєднатися до події</h1>
        {!event || identity.isPending || (identity.data && (join.isPending || registration.isPending || (status === 1 && invitation.isPending) || (canJoin && form.isPending))) || invited ? <p>Завантажуємо умови участі…</p>
            : identity.isError || join.isError || registration.isError || invitation.isError || (canJoin && form.isError) ? <div role="alert"><p>Не вдалося завантажити умови участі.</p><button className="ib-btn" type="button" onClick={() => void (identity.isError ? identity.refetch() : join.isError ? join.refetch() : registration.isError ? registration.refetch() : invitation.isError ? invitation.refetch() : form.refetch())}>Повторити</button></div>
            : !identity.data ? <p>Увійдіть до облікового запису, щоб приєднатися. Кнопка входу розташована вгорі сторінки.</p>
            : status === ParticipationStatusEnum.ApprovedParticipationStatus ? <p>Ви вже берете участь у події.</p>
            : status === ParticipationStatusEnum.PendingParticipationStatus ? <p>Заявку на участь надіслано. Дочекайтеся рішення організаторів.</p>
            : status === ParticipationStatusEnum.RejectedParticipationStatus ? <p>Заявку відхилено. Зверніться до організаторів події.</p>
            : !windowOpen(openedAt) ? <p>Реєстрацію на подію закрито.</p>
            : <>
                {form.data?.Enabled && <ParticipantFormFields form={form.data} answers={answers} onChange={setAnswers} />}
                {error && <p className="event-join-error" role="alert">{error}</p>}
                <button className="ib-btn ib-btn--primary" type="button" disabled={working} onClick={() => void submit()}>{working ? "Надсилаємо…" : "Приєднатися"}</button>
            </>}
    </div></div>;
}
