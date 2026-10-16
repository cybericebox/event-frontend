"use client";

import {useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers} from "@/api/participantForm";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {focusFirstInvalid} from "@/components/event/FormQuestion";
import {collectFormAnswers, ParticipantFormFields} from "@/components/event/ParticipantFormFields";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {JoinDialog} from "./JoinDialog";
import {useParticipantPreview, participantPreviewForm, ParticipantPreviewMenu} from "../ParticipantPreview";

// What a participant sees on /join and after it, played for the organizer. State lives in
// browser state only; the form definition is read (GET), nothing is ever written.
export function JoinPreview({event}: {event: PublicEventInfo}) {
    const preview = useParticipantPreview(event.EventID);
    const router = useRouter();
    const outcome = preview.state?.outcome ?? (event.Registration === 1 ? "pending" : "approved");
    const [answers, setAnswers] = useState<ParticipantAnswers>({});
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const fieldsRef = useRef<HTMLDivElement>(null);
    const teamMode = event.Participation === 1;
    const invitation = event.Registration === 0;
    const form = useQuery({queryKey: ["event-management-participant-form", event.EventID], queryFn: () => getManageParticipantForm(event.EventID), select: participantPreviewForm, retry: false, refetchOnWindowFocus: false});

    const submit = () => {
        const collected = collectFormAnswers(form.data, answers);
        if (collected.error) {
            setFieldErrors(collected.errors ?? {});
            setError(collected.errorKey ? "" : collected.error);
            requestAnimationFrame(() => focusFirstInvalid(fieldsRef.current));
            return;
        }
        setFieldErrors({});
        setError("");
        preview.update({status: outcome === "approved" ? 2 : outcome === "pending" ? 1 : 3, answers: collected.answers});
    };


    return <JoinDialog tools={<ParticipantPreviewMenu />} outcome={preview.state?.status ? outcome : undefined} teamMode={teamMode} onClose={() => router.push("/")}>
            {form.isPending ? <EventLoading event={event} label={t("join.loading")} />
                : form.isError ? <EventLoadError message={t("join.loadFailed")} error={form.error} onRetry={() => void form.refetch()} />
                : <>
                    {invitation && <p>{t("invite.acceptHint")}</p>}
                    {form.data?.Enabled && <div ref={fieldsRef}><ParticipantFormFields form={form.data} answers={answers} onChange={setAnswers} errors={fieldErrors} /></div>}
                    {error && <p className="event-join-error" role="alert">{error}</p>}
                    <EventButton className="ib-btn ib-btn--primary" type="button" onClick={submit}>{invitation ? t("invite.accept") : t("shell.join.action")}</EventButton>
                </>}
    </JoinDialog>;
}
