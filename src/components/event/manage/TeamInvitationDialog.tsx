"use client";

import {InviteParticipantsDialog} from "./InviteParticipantsDialog";

// Invitations straight into one team: the same dialog as «Запросити учасників».
export function TeamInvitationDialog({eventID, team, onClose, onSent}: {
    eventID: string;
    team: {ID: string; Name: string; InitialEmails?: string[]} | null;
    onClose: () => void;
    onSent: () => Promise<void>;
}) {
    return <InviteParticipantsDialog eventID={eventID} open={!!team} onOpenChange={open => {if (!open) onClose();}} onSent={onSent} team={team} initialEmails={team?.InitialEmails} />;
}
