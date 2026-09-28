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

function signInHref(eventTag: string | undefined): string | null {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    return domain && eventTag ? `https://id.${domain}/sign-in?return_to=${encodeURIComponent(`https://${eventTag}.${domain}/invite`)}` : null;
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
    const form = useQuery({queryKey: ["event-participant-form", event?.EventID], queryFn: () => getSelfParticipantForm(event!.EventID), enabled: !!event && actionable, retry: false});
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
            setError(apiErrorMessage(code, "Не вдалося прийняти запрошення. Перевірте відповіді та спробуйте ще раз."));
        } finally {setWorking(false);}
    }

    async function decline() {
        if (!event || working || !window.confirm("Відхилити запрошення? Прийняти його пізніше буде неможливо.")) return;
        setError("");
        setWorking(true);
        try {
            await declineSelfInvitation();
            await refreshStatus(ParticipationStatusEnum.NoParticipationStatus);
            router.push("/");
        } catch (failure) {
            setError(apiErrorMessage(failure instanceof ParticipantJoinError ? failure.code : undefined, "Не вдалося відхилити запрошення. Спробуйте ще раз."));
        } finally {setWorking(false);}
    }

    const home = <Link className="ib-btn" href="/">На головну</Link>;
    const signIn = signInHref(event?.Tag);
    const title = invitation?.InvitedTeamName ? `Вас запрошено до команди «${invitation.InvitedTeamName}»` : `Вас запрошено до події «${event?.Name ?? ""}»`;
    return <div className="event-join-page"><div className="event-join-card">
        <Link className="event-join-back" href="/">← На головну</Link>
        {!event || identity.isPending || (identity.data && (info.isPending || (actionable && form.isPending))) ? <><h1>Запрошення</h1><p>Завантажуємо запрошення…</p></>
            : identity.isError || info.isError || (actionable && form.isError) ? <><h1>Запрошення</h1><div role="alert"><p>Не вдалося завантажити запрошення.</p><button className="ib-btn" type="button" onClick={() => void (identity.isError ? identity.refetch() : info.isError ? info.refetch() : form.refetch())}>Повторити</button></div></>
            : !identity.data ? <><h1>Запрошення</h1><p>Увійдіть до облікового запису, на який надійшло запрошення.</p>{signIn ? <a className="ib-btn ib-btn--primary" href={signIn}>Увійти</a> : <p>Кнопка входу розташована вгорі сторінки.</p>}</>
            : invitation?.Status === ParticipationStatusEnum.ApprovedParticipationStatus ? <><h1>Ви вже учасник</h1><p>Ви вже берете участь у події.</p>{home}</>
            : !invitation?.Invited || invitation.Status !== ParticipationStatusEnum.PendingParticipationStatus ? <><h1>Запрошення не знайдено</h1><p>Активного запрошення для цього облікового запису немає.</p>{home}</>
            : invitation.InvitationExpired || expired ? <><h1>{title}</h1><p role="status">Запрошення прострочене: реєстрацію закрито.</p>{home}</>
            : invitation.TeamUnavailable ? <><h1>Запрошення</h1><p role="status">Команда, до якої вас запросили, більше недоступна. Зверніться до організаторів події.</p>{home}</>
            : <>
                <h1>{title}</h1>
                <p>Прийміть запрошення, щоб стати учасником{invitation.InvitedTeamName ? " і приєднатися до команди" : ""}.</p>
                {form.data?.Enabled && <ParticipantFormFields form={form.data} answers={answers} onChange={setAnswers} idPrefix="invite" />}
                {error && <p className="event-join-error" role="alert">{error}</p>}
                <div className="event-join-actions"><button className="ib-btn ib-btn--primary" type="button" disabled={working} onClick={() => void accept()}>{working ? "Зачекайте…" : "Прийняти"}</button><button className="ib-btn" type="button" disabled={working} onClick={() => void decline()}>Відхилити</button></div>
            </>}
    </div></div>;
}
