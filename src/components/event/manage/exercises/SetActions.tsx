"use client";

import {ArrowUpCircle, GitFork, Pencil, RotateCcw, Unlink} from "lucide-react";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {t} from "@/i18n/t";
import {ActionMenu, type ActionMenuItem} from "./ActionMenu";
import type {AttachmentKind} from "./attachmentModel";

export type SetActionKind = "fork" | "update" | "revert" | "detach";

// Every action of a set, in «⋯»: copy (off with its reason for a set that
// cannot work here), edit, update, revert; removing last in danger colour.
export function setMenuItems({attachment, kind, editURL, broken, onAction}: {
    attachment: Pick<EventExerciseAttachment, "UpdateAvailable">; kind: AttachmentKind; editURL: string | null; broken: boolean;
    onAction: (action: SetActionKind) => void;
}): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];
    if (kind === "catalog") items.push({key: "fork", label: t("manage.exercises.fork"), icon: GitFork, onSelect: () => onAction("fork"),
        disabledReason: broken ? t("manage.challenges.set.forkBroken") : undefined});
    if (editURL) items.push({key: "edit", label: t("manage.challenges.set.editTip"), icon: Pencil, href: editURL});
    if (attachment.UpdateAvailable) items.push({key: "update", label: t("manage.challenges.set.update"), icon: ArrowUpCircle, onSelect: () => onAction("update")});
    if (kind === "fork") items.push({key: "revert", label: t("manage.exercises.revert"), icon: RotateCcw, onSelect: () => onAction("revert")});
    items.push({key: "detach", label: t("manage.exercises.action.detach.confirm"), icon: Unlink, danger: true, onSelect: () => onAction("detach")});
    return items;
}

export function SetActions({attachment, kind, name, editURL, busy, broken = false, onAction}: {
    attachment: EventExerciseAttachment; kind: AttachmentKind; name: string; editURL: string | null; busy: boolean; broken?: boolean;
    onAction: (action: SetActionKind) => void;
}) {
    return <div className="event-exercise-set__actions">
        <ActionMenu label={t("manage.challenges.set.more", {name})} disabled={busy} items={setMenuItems({attachment, kind, editURL, broken, onAction})} />
    </div>;
}
