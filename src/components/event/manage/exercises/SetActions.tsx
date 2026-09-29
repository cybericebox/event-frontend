"use client";

import {ArrowUpCircle, GitFork, Pencil, RotateCcw, Unlink, type LucideIcon} from "lucide-react";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import type {AttachmentKind} from "./attachmentModel";

export type SetActionKind = "fork" | "update" | "revert" | "detach";
export type ToolbarAction = {
    key: string; label: string; icon: LucideIcon; onSelect?: () => void; href?: string;
    // Shown as the tooltip of a disabled action.
    disabledReason?: string;
    // Removing: danger style, pushed to the right end.
    danger?: boolean;
};

// The actions a set offers, in toolbar order.
export function setToolbarActions({attachment, kind, editURL, broken, onAction}: {
    attachment: Pick<EventExerciseAttachment, "UpdateAvailable">; kind: AttachmentKind; editURL: string | null; broken: boolean;
    onAction: (action: SetActionKind) => void;
}): ToolbarAction[] {
    const actions: ToolbarAction[] = [];
    if (kind === "catalog") actions.push({key: "fork", label: t("manage.exercises.fork"), icon: GitFork, onSelect: () => onAction("fork"),
        disabledReason: broken ? t("manage.challenges.set.forkBroken") : undefined});
    if (editURL) actions.push({key: "edit", label: t("manage.challenges.set.editTip"), icon: Pencil, href: editURL});
    if (attachment.UpdateAvailable) actions.push({key: "update", label: t("manage.challenges.set.update"), icon: ArrowUpCircle, onSelect: () => onAction("update")});
    if (kind === "fork") actions.push({key: "revert", label: t("manage.exercises.revert"), icon: RotateCcw, onSelect: () => onAction("revert")});
    actions.push({key: "detach", label: t("manage.exercises.action.detach.confirm"), icon: Unlink, danger: true, onSelect: () => onAction("detach")});
    return actions;
}

// Compact text buttons with icons; a disabled one keeps its reason reachable
// (aria-disabled + tooltip), the danger one sits at the right end.
export function ActionToolbar({label, actions, busy}: {label: string; actions: ToolbarAction[]; busy: boolean}) {
    return <div className="event-action-toolbar" role="toolbar" aria-label={label}>
        {actions.map(action => {
            const className = `ib-btn ib-btn--sm${action.danger ? " ib-btn--danger event-action-toolbar__end" : ""}`;
            const content = <><action.icon aria-hidden="true" />{action.label}</>;
            if (action.disabledReason) return <EventTooltip key={action.key} content={action.disabledReason}>{id =>
                <button className={className} type="button" aria-disabled="true" aria-describedby={id}>{content}</button>}</EventTooltip>;
            if (action.href) return <a key={action.key} className={className} href={action.href}>{content}</a>;
            return <button key={action.key} className={className} type="button" disabled={busy} onClick={action.onSelect}>{content}</button>;
        })}
    </div>;
}

export function SetActions({attachment, kind, name, editURL, busy, broken = false, onAction}: {
    attachment: EventExerciseAttachment; kind: AttachmentKind; name: string; editURL: string | null; busy: boolean; broken?: boolean;
    onAction: (action: SetActionKind) => void;
}) {
    return <ActionToolbar label={t("manage.challenges.set.more", {name})} busy={busy} actions={setToolbarActions({attachment, kind, editURL, broken, onAction})} />;
}
