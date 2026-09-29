"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {getSelfTeamFields} from "@/api/eventTeams";
import {getOwnParticipantAnswers} from "@/api/participantForm";
import type {OwnTeam} from "@/api/clientAuth";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import {EventBanner} from "@/components/event/EventBanner";
import {formFields} from "@/components/event/participation/participationModel";
import {t} from "@/i18n/t";

export const PROFILE_PATH = "/participation";
export const TEAM_PATH = "/team";

function labels(form: ParticipantForm | null | undefined, keys: readonly string[]): string {
    const fields: FormField[] = formFields(form);
    return keys.map(key => fields.find(field => field.key === key)?.label.trim() || key).join(", ");
}

// «Заповніть нові поля»: the organizer added required fields and asked
// everyone to fill them. Nobody is locked out; a submission block, when the
// organizer chose it, is said in the text. The fields themselves are marked on
// «Мій профіль учасника» and «Моя команда».
export function MissingFieldsNotice({eventID, ownTeam}: {eventID: string; ownTeam: OwnTeam | null}) {
    const pathname = usePathname();
    const answers = useQuery({queryKey: ["event-own-answers", eventID], queryFn: () => getOwnParticipantAnswers(), retry: false, refetchOnWindowFocus: false});
    const personal = answers.data?.Missing ?? [];
    const teamKeys = ownTeam?.MissingFields ?? [];
    const teamForm = useQuery({queryKey: ["event-team-fields", eventID], queryFn: () => getSelfTeamFields(), enabled: teamKeys.length > 0, refetchOnWindowFocus: false});
    const onOwnPage = pathname === PROFILE_PATH || pathname === TEAM_PATH;
    if (onOwnPage || (personal.length === 0 && teamKeys.length === 0)) return null;
    return <div className="ib-banner-stack">
        {personal.length > 0 && <EventBanner tone="warning" title={t("participation.missing.title")}
            message={t(answers.data?.Blocking ? "participation.missing.participantBlocking" : "participation.missing.participant", {fields: labels(answers.data?.Form, personal)})}
            action={<Link className="ib-btn ib-btn--sm" href={PROFILE_PATH}>{t("participation.missing.openProfile")}</Link>} />}
        {teamKeys.length > 0 && <EventBanner tone="warning" title={t("participation.missing.title")}
            message={t(ownTeam?.BlockingFields ? "participation.missing.teamBlocking" : "participation.missing.team", {fields: labels(teamForm.data, teamKeys)})}
            action={<Link className="ib-btn ib-btn--sm" href={TEAM_PATH}>{t("participation.missing.openTeam")}</Link>} />}
    </div>;
}
