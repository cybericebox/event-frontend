"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {GitFork, MoreHorizontal, Pencil, RotateCcw, Unlink, ArrowUpCircle, type LucideIcon} from "lucide-react";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import type {AttachmentKind} from "./attachmentModel";

export type SetActionKind = "fork" | "update" | "revert" | "detach";
type MenuItem = {action: SetActionKind; label: string; icon: LucideIcon};

// The rare actions of a set («⋯»): update when a newer version exists,
// revert for an event copy, and removing, which is always there.
export function setMenuItems(attachment: Pick<EventExerciseAttachment, "UpdateAvailable">, kind: AttachmentKind): MenuItem[] {
    const items: MenuItem[] = [];
    if (attachment.UpdateAvailable) items.push({action: "update", label: t("manage.challenges.set.update"), icon: ArrowUpCircle});
    if (kind === "fork") items.push({action: "revert", label: t("manage.exercises.revert"), icon: RotateCcw});
    items.push({action: "detach", label: t("manage.exercises.action.detach.confirm"), icon: Unlink});
    return items;
}

// A set header's actions: icon buttons with our tooltips for the common
// ones, the rare ones in «⋯». A set that cannot work here (infrastructure
// missing) is not worth copying: the copy action is off with its reason.
export function SetActions({attachment, kind, name, editURL, busy, broken = false, onAction}: {
    attachment: EventExerciseAttachment; kind: AttachmentKind; name: string; editURL: string | null; busy: boolean; broken?: boolean;
    onAction: (action: SetActionKind) => void;
}) {
    const items = setMenuItems(attachment, kind);
    return <div className="event-exercise-set__actions">
        {kind === "catalog" && <EventTooltip content={broken ? t("manage.challenges.set.forkBroken") : t("manage.challenges.set.forkTip")}>{id =>
            // aria-disabled keeps the reason reachable by hover and focus.
            <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.exercises.fork")} aria-describedby={id} aria-disabled={broken || undefined} disabled={busy}
                onClick={() => { if (!broken) onAction("fork"); }}><GitFork size={16} aria-hidden="true" /></button>}</EventTooltip>}
        {editURL && <EventTooltip content={t("manage.challenges.set.editTip")}>{id =>
            <a className="ib-icon-btn ib-icon-btn--sm" href={editURL} aria-label={t("manage.challenges.set.editTip")} aria-describedby={id}><Pencil size={16} aria-hidden="true" /></a>}</EventTooltip>}
        <EventTooltip content={t("manage.exercises.action.detach.confirm")}>{id =>
            <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.exercises.action.detach.confirm")} aria-describedby={id} disabled={busy} onClick={() => onAction("detach")}><Unlink size={16} aria-hidden="true" /></button>}</EventTooltip>
        {items.length > 0 && <DropdownMenu.Root>
            <DropdownMenu.Trigger className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.challenges.set.more", {name})} disabled={busy}><MoreHorizontal size={16} aria-hidden="true" /></DropdownMenu.Trigger>
            {/* Portal + collision padding: the card never clips the menu. */}
            <DropdownMenu.Portal><DropdownMenu.Content className="ib-listbox event-action-menu" sideOffset={4} align="end" collisionPadding={12}>
                {items.map(item => <DropdownMenu.Item key={item.action} className="ib-listbox__opt event-action-menu__item" onSelect={() => onAction(item.action)}>
                    <item.icon size={16} aria-hidden="true" /><span>{item.label}</span>
                </DropdownMenu.Item>)}
            </DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu.Root>}
    </div>;
}
