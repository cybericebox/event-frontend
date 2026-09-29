import type {OwnTeam} from "@/api/clientAuth";
import type {TeamMember} from "@/api/eventTeams";
import {TeamRole} from "@/api/eventTeams";
import type {ParticipantEventInfo} from "@/types/participantEventInfo";
import {t} from "@/i18n/t";

// Sample data for the organizers' preview of the participant pages: the same pages
// the participant sees, filled with made-up people. Nothing here is saved.
const PREVIEW_ID = "00000000-0000-4000-8000-000000000001";
const PREVIEW_MEMBER_ID = "00000000-0000-4000-8000-000000000002";
const PREVIEW_INVITEE_ID = "00000000-0000-4000-8000-000000000003";

export function previewOwnTeam(): OwnTeam {
    return {
        ID: PREVIEW_ID, Name: t("participation.preview.teamName"), MemberCount: 2, ExtraFields: {},
        JoinCode: "preview-team-code", JoinCodeExpiresAt: null, CaptainID: PREVIEW_ID, Role: TeamRole.Captain,
        Admitted: true, MinTeamSize: 2, MaxTeamSize: 4,
    };
}

export function previewMembers(): TeamMember[] {
    return [
        {UserID: PREVIEW_ID, DisplayName: t("participation.preview.captain"), Role: TeamRole.Captain, Own: true, Pending: false},
        {UserID: PREVIEW_MEMBER_ID, DisplayName: t("participation.preview.member"), Role: TeamRole.Member, Own: false, Pending: false},
        {UserID: PREVIEW_INVITEE_ID, DisplayName: t("participation.preview.invitee"), Role: TeamRole.Member, Own: false, Pending: true},
    ];
}

export function previewParticipantInfo(eventID: string): ParticipantEventInfo {
    return {
        EventID: eventID, UseVPN: false, CanViewResults: true, CanViewParticipants: false, Participation: 1,
        RealName: t("participation.preview.captain"), Pseudonym: null, DisplayName: t("participation.preview.captain"),
        AllowPseudonyms: false, PseudonymEditable: false, TeamID: PREVIEW_ID, TeamAdmitted: true, MinTeamSize: 2, MaxTeamSize: 4,
        ShowDifficulty: true, HintsDisabled: false, HasInfrastructureChallenges: false, HintChargeMode: "reward",
    };
}
