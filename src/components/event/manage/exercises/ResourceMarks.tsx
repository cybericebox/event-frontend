"use client";

import type {TaskResources} from "@/api/manageChallenges";
import {t} from "@/i18n/t";
import {hasResources, resourcesText} from "./resourceModel";

// An approved resource elevation: the task is heavier than the platform frame.
export function ResourceHeavyTag({show}: {show: boolean}) {
    return show ? <span className="ib-tag ib-tag--sm ib-tag--warn" data-resource-heavy>{t("manage.resources.heavy")}</span> : null;
}

// No laboratory that is used can run the set (no laboratory is named).
export function NoAgentFitsTag({show}: {show: boolean}) {
    return show ? <span className="ib-tag ib-tag--sm ib-tag--danger" data-no-agent-fits>{t("manage.resources.noAgentFits")}</span> : null;
}

// The total resources of a set of tasks (CPU, memory, devices).
export function ResourcesLine({resources, className = "event-resources-line"}: {resources: TaskResources | null; className?: string}) {
    return hasResources(resources) ? <span className={className} data-resources-total>{resourcesText(resources)}</span> : null;
}
