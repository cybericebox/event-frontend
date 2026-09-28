import type {ManageParticipantCounts, ParticipantListKind} from "@/api/manageParticipants";

export type ParticipantTab = ParticipantListKind;

export const participantTabs: {value: ParticipantTab; label: string; count: keyof ManageParticipantCounts}[] = [
    {value: "participants", label: "Учасники", count: "Participants"},
    {value: "applications", label: "Заявки", count: "Applications"},
    {value: "invitations", label: "Запрошення", count: "Invitations"},
];

// `?tab=` selects the tab; the legacy `?status=pending` link opens applications.
export function participantTabFromParams(tab: string | null | undefined, status?: string | null): ParticipantTab {
    const match = participantTabs.find(item => item.value === tab);
    if (match) return match.value;
    if (status === "pending" || status === "rejected") return "applications";
    return "participants";
}

export function participantTabHref(tab: ParticipantTab): string {
    return tab === "participants" ? "/manage/participants" : `/manage/participants?tab=${tab}`;
}
