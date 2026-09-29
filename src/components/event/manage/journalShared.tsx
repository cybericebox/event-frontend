"use client";

import {useQuery} from "@tanstack/react-query";
import {getModeratorResults} from "@/api/manageResults";
import {getManageParticipants} from "@/api/manageParticipants";
import {getEventBoardChallenges, getEventExerciseAttachments} from "@/api/manageChallenges";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {useManager} from "./ManagerShell";
import {t} from "@/i18n/t";
import "./journal.css";

// Shared by the «Журнал спроб» views (attempts and hints).

const all = "all";

// Times are shown in the viewer's own time zone; the table header names it.
export const journalTime = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"});

// Challenge filter options: every active board challenge of the event.
async function listChallengeOptions(eventID: string) {
    const attachments = (await getEventExerciseAttachments(eventID)).filter(item => !item.SupersededAt);
    const boards = await Promise.all(attachments.map(item => getEventBoardChallenges(eventID, item.ID)));
    return boards.flat().sort((a, b) => a.Order - b.Order).map(item => ({value: item.ID, label: item.Snapshot.name || t("manage.attempts.challenge")}));
}

// Filter options shared by both journal views: teams (or solo participants),
// team members and tasks.
export function useJournalOptions() {
    const {event} = useManager();
    const eventID = event.EventID;
    const teamMode = event.Participation === 1;
    const teams = useQuery({queryKey: ["event-management-moderator-results", eventID], queryFn: () => getModeratorResults(eventID), refetchOnWindowFocus: false});
    const participants = useQuery({queryKey: ["event-manage-attempt-participants", eventID], queryFn: () => getManageParticipants(eventID, {kind: "participants"}, null, 100), enabled: teamMode, refetchOnWindowFocus: false});
    const challenges = useQuery({queryKey: ["event-manage-attempt-challenges", eventID], queryFn: () => listChallengeOptions(eventID), refetchOnWindowFocus: false});
    return {
        teams: [{value: all, label: teamMode ? t("manage.attempts.filter.allTeams") : t("manage.attempts.filter.allParticipants")}, ...(teams.data?.Teams ?? []).map(team => ({value: team.TeamID, label: team.RealName && team.RealName !== team.Name ? t("manage.attempts.teamWithRealName", {name: team.Name, realName: team.RealName}) : team.Name}))],
        participants: [{value: all, label: t("manage.attempts.filter.allParticipants")}, ...(participants.data?.Items ?? []).map(item => ({value: item.UserID, label: item.Name || item.Email}))],
        challenges: [{value: all, label: t("manage.attempts.filter.allChallenges")}, ...(challenges.data ?? [])],
    };
}

// Period bounds of a journal toolbar: the date-time picker in local time.
export function PeriodFilters({from, to, onChange}: {from: string; to: string; onChange: (patch: {from?: string; to?: string}) => void}) {
    return <>
        <div className="event-journal__period"><span>{t("manage.attempts.filter.from")}</span><EventDateTimePicker ariaLabel={t("manage.attempts.filter.from")} value={from} placeholder={t("manage.attempts.filter.anyTime")} allowClear onChange={value => onChange({from: value})} /></div>
        <div className="event-journal__period"><span>{t("manage.attempts.filter.to")}</span><EventDateTimePicker ariaLabel={t("manage.attempts.filter.to")} value={to} placeholder={t("manage.attempts.filter.anyTime")} allowClear onChange={value => onChange({to: value})} /></div>
    </>;
}

