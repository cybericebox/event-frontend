"use client";

import {useQuery} from "@tanstack/react-query";
import {getParticipation, type Participation} from "@/api/clientAuth";
import {t} from "@/i18n/t";

// The reason codes the server sends with a blocked participation action. Each
// has its own message, so a closed control always says why it is closed.
const reasons = [
    "not_signed_in", "staff_cannot_participate", "not_published", "registration_closed", "closed_at_start", "event_finished", "event_withdrawn",
    "pending", "rejected", "already_participant", "not_approved", "roster_frozen_at_start", "not_team_event", "already_in_team", "no_team",
    "not_captain", "captain_must_transfer", "not_started",
] as const;
type Reason = typeof reasons[number];

const isReason = (code: string): code is Reason => (reasons as readonly string[]).includes(code);

// The message for a reason code; empty for "no reason" and for codes this site does not know yet.
export function reasonText(code: string): string {
    return isReason(code) ? t(`participation.reason.${code}`) : "";
}

// The signed-in viewer's participation block; the query key is shared, so the
// join page, the banner, the action buttons and the team tab ask the server once.
export function useParticipation(eventID: string | undefined, enabled = true) {
    return useQuery<Participation | null>({
        queryKey: ["event-participation", eventID], queryFn: getParticipation,
        enabled: enabled && !!eventID, retry: false, refetchOnWindowFocus: false,
    });
}
