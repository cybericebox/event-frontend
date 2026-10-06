"use client";

import type {ReactNode} from "react";
import type {ManageParticipantDetail} from "@/api/manageParticipants";
import {t} from "@/i18n/t";
import {formatDateTime} from "@/utils/dateTime";

const statusKeys = {1: "manage.participants.status.pending", 2: "manage.participants.status.approved", 3: "manage.participants.status.rejected"} as const;
const statusTags = {1: "ib-tag--warn", 2: "ib-tag--ok", 3: "ib-tag--danger"} as const;

function Fact({label, children}: {label: string; children: ReactNode}) {
    return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

// Key/value rows of the participant modal, styled like the «Деталі надсилання» facts.
export function ParticipantFacts({participant, teamMode, pseudonyms}: {participant: ManageParticipantDetail; teamMode: boolean; pseudonyms: boolean}) {
    const invited = participant.JoinedVia === "invitation";
    return <dl className="event-mail-detail__facts" data-testid="participant-facts">
        <Fact label={t("manage.participants.detail.status")}><span className={`ib-tag ${statusTags[participant.Status]}`}>{t(statusKeys[participant.Status])}</span></Fact>
        {(pseudonyms || participant.Pseudonym) && participant.Pseudonym && <Fact label={t("manage.participants.detail.pseudonym")}>{participant.Pseudonym}</Fact>}
        {teamMode && <Fact label={t("manage.participants.detail.team")}>{participant.TeamID ? participant.TeamName || t("manage.participants.inTeam") : t("manage.participants.noTeam")}</Fact>}
        {teamMode && participant.TeamRole !== null && <Fact label={t("manage.participants.detail.role")}>{t(participant.TeamRole === 0 ? "manage.participants.detail.role.captain" : "manage.participants.detail.role.member")}</Fact>}
        <Fact label={t("manage.participants.detail.registered")}><time dateTime={participant.CreatedAt}>{formatDateTime(participant.CreatedAt)}</time></Fact>
        {participant.DecidedAt && <Fact label={t("manage.participants.detail.decided")}><time dateTime={participant.DecidedAt}>{formatDateTime(participant.DecidedAt)}</time></Fact>}
        {participant.JoinedVia && <Fact label={t("manage.participants.detail.joinedVia")}>{t(`manage.participants.detail.joinedVia.${participant.JoinedVia}`)}</Fact>}
        {invited && participant.InvitationSentAt && <Fact label={t("manage.participants.detail.invitationSent")}><time dateTime={participant.InvitationSentAt}>{formatDateTime(participant.InvitationSentAt)}</time></Fact>}
        <Fact label={t("manage.participants.detail.solves")}>{participant.Solves}</Fact>
        <Fact label={t("manage.participants.detail.attempts")}>{participant.Attempts}</Fact>
    </dl>;
}
