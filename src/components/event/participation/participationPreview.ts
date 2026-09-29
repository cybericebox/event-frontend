import type {OwnTeam} from "@/api/clientAuth";
import type {TeamMember} from "@/api/eventTeams";
import {TeamRole} from "@/api/eventTeams";
import type {ParticipationStats} from "@/api/participationStats";
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

// Made-up results for the preview: a few solves spread over the last hours, split between the two members.
export function previewStats(now: number): ParticipationStats {
    const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
    const solve = (name: string, category: string, points: number, minutesAgo: number, by: string, byName: string, firstBlood = false) => ({
        EventChallengeID: `00000000-0000-4000-8000-0000000001${minutesAgo}`, ChallengeName: name, Category: category, Points: points,
        SolvedAt: at(minutesAgo), SolvedByUserID: by, SolvedByName: byName, FirstBlood: firstBlood,
    });
    const solves = [
        solve(t("participation.preview.task1"), t("participation.preview.category.web"), 100, 240, PREVIEW_ID, t("participation.preview.captain"), true),
        solve(t("participation.preview.task2"), t("participation.preview.category.crypto"), 150, 170, PREVIEW_MEMBER_ID, t("participation.preview.member")),
        solve(t("participation.preview.task3"), t("participation.preview.category.forensics"), 200, 95, PREVIEW_ID, t("participation.preview.captain")),
        solve(t("participation.preview.task4"), t("participation.preview.category.web"), 250, 30, PREVIEW_MEMBER_ID, t("participation.preview.member")),
    ];
    const member = (id: string, name: string, role: number, points: number, count: number, attempts: number, correct: number, hints: number) => ({
        UserID: id, Name: name, Role: role, JoinedAt: at(600), Points: points, Solves: count, FirstBloods: id === PREVIEW_ID ? 1 : 0, Attempts: attempts, CorrectAttempts: correct, Hints: hints,
    });
    const captain = member(PREVIEW_ID, t("participation.preview.captain"), TeamRole.Captain, 300, 2, 7, 2, 1);
    return {
        Rank: 3, Points: 700, Solved: 4, Frozen: false,
        Team: {
            TeamID: PREVIEW_ID, TeamName: t("participation.preview.teamName"), Attempts: 16, CorrectAttempts: 4, Hints: 2, FirstBloods: 1, Solves: solves,
            Members: [captain, member(PREVIEW_MEMBER_ID, t("participation.preview.member"), TeamRole.Member, 400, 2, 9, 2, 1)],
        },
        Me: captain,
        Timeline: solves.map(item => ({EventChallengeID: item.EventChallengeID, Points: item.Points, SolvedAt: item.SolvedAt})),
    };
}
