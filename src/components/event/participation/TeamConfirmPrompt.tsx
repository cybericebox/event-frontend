"use client";

import {useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {formEventTeam, TeamRole} from "@/api/eventTeams";
import {EventBanner} from "@/components/event/EventBanner";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {errorText, TeamConfirm, type Confirm} from "./participationParts";
import {reasonText, useParticipation} from "./participationRules";

// Only for a team that waits for its captain (late-join team event, team not formed): the captain is asked to
// confirm the roster, the members are told they wait for the captain. Everywhere else it renders nothing, so
// an event whose start forms every team never mentions the confirmation.
export function TeamConfirmPrompt({eventID}: {eventID: string}) {
    const participant = useParticipantContext();
    const ownTeam = participant?.ownTeam ?? null;
    const queryClient = useQueryClient();
    const participation = useParticipation(eventID, !!ownTeam && !ownTeam.Formed);
    const [confirm, setConfirm] = useState<Confirm>(null);
    const state = participation.data;
    if (!ownTeam || ownTeam.Formed || !state?.TeamNeedsConfirmation) return null;
    if (ownTeam.Role !== TeamRole.Captain) return <EventBanner tone="info" title={t("participation.team.confirmWaiting")} />;
    const form = state.FormTeam;
    const reason = form.Allowed ? "" : reasonText(form.Reason);
    const confirmRoster = async () => {
        try {
            await formEventTeam(eventID);
        } catch (error) {
            throw new Error(errorText(error, t("participation.team.formFailed")), {cause: error});
        }
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["event-participation", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-own-team", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-participant-info", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-own-challenges", eventID]}),
        ]);
        toast.success(t("participation.team.formed"));
    };
    return <>
        <EventBanner tone="warning" title={t("participation.team.confirmPrompt")} message={reason || t("participation.team.confirmWarning")}
            action={form.Allowed ? <EventButton className="ib-btn ib-btn--sm ib-btn--primary" onClick={() => setConfirm({title: t("participation.team.formTitle"), text: t("participation.team.formText"), action: t("participation.team.formAction"), run: confirmRoster})}>{t("participation.team.form")}</EventButton> : undefined} />
        <TeamConfirm confirm={confirm} onClose={() => setConfirm(null)} />
    </>;
}
