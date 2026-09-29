"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {GitFork, MoreHorizontal, Pencil, Unlink} from "lucide-react";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import type {AttachmentKind} from "./attachmentModel";

export type SetActionKind = "fork" | "update" | "revert" | "detach";

// A set header's actions: icon buttons with our tooltips for the common
// ones, the rare ones in «⋯».
export function SetActions({attachment, kind, name, editURL, busy, onAction}: {
    attachment: EventExerciseAttachment; kind: AttachmentKind; name: string; editURL: string | null; busy: boolean;
    onAction: (action: SetActionKind) => void;
}) {
    return <div className="event-exercise-set__actions">
        {kind === "catalog" && <EventTooltip content={t("manage.challenges.set.forkTip")}>{id =>
            <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.exercises.fork")} aria-describedby={id} disabled={busy} onClick={() => onAction("fork")}><GitFork size={16} aria-hidden="true" /></button>}</EventTooltip>}
        {editURL && <EventTooltip content={t("manage.challenges.set.editTip")}>{id =>
            <a className="ib-icon-btn ib-icon-btn--sm" href={editURL} aria-label={t("manage.challenges.set.editTip")} aria-describedby={id}><Pencil size={16} aria-hidden="true" /></a>}</EventTooltip>}
        <EventTooltip content={t("manage.exercises.action.detach.confirm")}>{id =>
            <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.exercises.action.detach.confirm")} aria-describedby={id} disabled={busy} onClick={() => onAction("detach")}><Unlink size={16} aria-hidden="true" /></button>}</EventTooltip>
        <DropdownMenu.Root>
            <DropdownMenu.Trigger className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.challenges.set.more", {name})} disabled={busy}><MoreHorizontal size={16} aria-hidden="true" /></DropdownMenu.Trigger>
            <DropdownMenu.Portal><DropdownMenu.Content className="ib-listbox event-select__menu" sideOffset={4} align="end" collisionPadding={8}>
                {attachment.UpdateAvailable && <DropdownMenu.Item className="ib-listbox__opt event-select__option" onSelect={() => onAction("update")}>{t("manage.challenges.set.update")}</DropdownMenu.Item>}
                {kind === "fork" && <DropdownMenu.Item className="ib-listbox__opt event-select__option" onSelect={() => onAction("revert")}>{t("manage.exercises.revert")}</DropdownMenu.Item>}
                <DropdownMenu.Item className="ib-listbox__opt event-select__option" onSelect={() => onAction("detach")}>{t("manage.exercises.action.detach.confirm")}</DropdownMenu.Item>
            </DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu.Root>
    </div>;
}
