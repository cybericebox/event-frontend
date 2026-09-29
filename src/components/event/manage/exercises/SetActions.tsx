"use client";

import {ArrowUpCircle, GitFork, Pencil, RotateCcw, Unlink, type LucideIcon} from "lucide-react";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import type {AttachmentKind} from "./attachmentModel";

export type SetActionKind = "fork" | "update" | "revert" | "detach";
export type RowAction = {
    key: string; label: string; icon: LucideIcon; onSelect?: () => void; href?: string;
    // A disabled action explains itself in its tooltip.
    disabledReason?: string;
    // Removing: danger colour, always last.
    danger?: boolean;
};

// The actions a set offers, in header order.
export function setRowActions({attachment, kind, editURL, broken, onAction}: {
    attachment: Pick<EventExerciseAttachment, "UpdateAvailable">; kind: AttachmentKind; editURL: string | null; broken: boolean;
    onAction: (action: SetActionKind) => void;
}): RowAction[] {
    const actions: RowAction[] = [];
    if (kind === "catalog") actions.push({key: "fork", label: t("manage.exercises.fork"), icon: GitFork, onSelect: () => onAction("fork"),
        disabledReason: broken ? t("manage.challenges.set.forkBroken") : undefined});
    if (editURL) actions.push({key: "edit", label: t("manage.challenges.set.editTip"), icon: Pencil, href: editURL});
    if (attachment.UpdateAvailable) actions.push({key: "update", label: t("manage.challenges.set.update"), icon: ArrowUpCircle, onSelect: () => onAction("update")});
    if (kind === "fork") actions.push({key: "revert", label: t("manage.exercises.revert"), icon: RotateCcw, onSelect: () => onAction("revert")});
    actions.push({key: "detach", label: t("manage.exercises.action.detach.confirm"), icon: Unlink, danger: true, onSelect: () => onAction("detach")});
    return actions;
}

// Icon-only row actions like the constructor's block actions: each has our
// tooltip with its full name (and why, when disabled) and an aria-label.
export function RowActions({label, actions, busy = false}: {label: string; actions: RowAction[]; busy?: boolean}) {
    return <div className="event-row-actions" role="group" aria-label={label}>
        {actions.map(action => {
            const className = `event-row-actions__button${action.danger ? " is-danger" : ""}`;
            const icon = <action.icon size={16} aria-hidden="true" />;
            const tip = action.disabledReason ? `${action.label}. ${action.disabledReason}` : action.label;
            return <EventTooltip key={action.key} content={tip}>{id => action.disabledReason
                ? <button className={className} type="button" aria-label={action.label} aria-describedby={id} aria-disabled="true">{icon}</button>
                : action.href
                    ? <a className={className} href={action.href} aria-label={action.label} aria-describedby={id}>{icon}</a>
                    : <button className={className} type="button" aria-label={action.label} aria-describedby={id} disabled={busy} onClick={action.onSelect}>{icon}</button>}</EventTooltip>;
        })}
    </div>;
}

export function SetActions({attachment, kind, name, editURL, busy, broken = false, onAction}: {
    attachment: EventExerciseAttachment; kind: AttachmentKind; name: string; editURL: string | null; busy: boolean; broken?: boolean;
    onAction: (action: SetActionKind) => void;
}) {
    return <RowActions label={t("manage.challenges.set.more", {name})} busy={busy} actions={setRowActions({attachment, kind, editURL, broken, onAction})} />;
}
