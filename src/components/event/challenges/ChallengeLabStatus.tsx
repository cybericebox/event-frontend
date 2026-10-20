"use client";

import type {LabRuntime} from "@/api/manageLabs";
import type {LabLifecycle} from "@/api/labLifecycle";
import {EventLoadError} from "@/components/event/EventLoadError";
import {BusyMark} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {hasCurrentRuntime} from "./descriptionValues";

export function ChallengeLabStatus({lab, lifecycle, withdrawn, error, onRetry}: {lab?: LabRuntime; lifecycle?: LabLifecycle | null; withdrawn: boolean; error?: unknown; onRetry: () => void}) {
    if (withdrawn || lifecycle?.LogicalClosed) return <p className="event-cmodal__lab-status" role="status">{t("challenges.lab.closed")}</p>;
    const ready = hasCurrentRuntime(lab, lifecycle) && lab?.Ready;
    if (ready) return null;
    if (error || lifecycle?.RuntimeState === "unavailable" || lab?.Phase.toLowerCase() === "failed") return <EventLoadError className="event-cmodal__lab-error" compact error={error} message={t("challenges.lab.unavailable")} onRetry={onRetry} />;
    return <p className="event-cmodal__lab-status" role="status"><BusyMark />{t("challenges.lab.starting")}</p>;
}
