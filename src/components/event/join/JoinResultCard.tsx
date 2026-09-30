import type {ReactNode} from "react";
import {CircleCheck, CircleX, Clock, type LucideIcon} from "lucide-react";
import type {JoinOutcome} from "./joinPreviewModel";

export const joinResultIcons: Record<JoinOutcome, LucideIcon> = {approved: CircleCheck, pending: Clock, rejected: CircleX};

// The end of an application: a status card tinted by outcome. Shared by the real
// /join page and the organizer's preview.
export function JoinResultCard({outcome, title, text, action}: {outcome: JoinOutcome; title: string; text: string; action?: ReactNode}) {
    const Icon = joinResultIcons[outcome];
    return <div className={`event-join-result event-join-result--${outcome}`} data-outcome={outcome}>
        <span className="event-join-result__icon" aria-hidden="true"><Icon size={36} strokeWidth={1.75} /></span>
        <h2>{title}</h2>
        <p>{text}</p>
        {action && <div className="event-join-result__acts">{action}</div>}
    </div>;
}
