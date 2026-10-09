import type {AllocationView, ComputeView, ResourceObservation} from "@/api/labObservations";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";
import {decimalCpu, decimalMemory} from "./resourceObservationModel";
import "./resources.css";

const computeText = (value: ComputeView) => t("manage.resources.observation.computeValue", {cpu: decimalCpu(value.CPUMillicores), memory: decimalMemory(value.MemoryBytes)});
const unknown = () => t("manage.resources.observation.unknown");
const positive = (value: ComputeView) => value.CPUMillicores !== "0" || value.MemoryBytes !== "0";

export function AllocationFacts({resources, current = false}: {resources: AllocationView; current?: boolean}) {
    // Configured amounts and retained nonzero allocations remain readable during an observation gap.
    const observed = current && resources.RuntimeState !== "Unknown" && resources.ObservedAt !== null && Number.isFinite(Date.parse(resources.ObservedAt));
    return <dl className="event-resources__facts">
        <div><dt>{t("manage.resources.observation.configuredRequests")}</dt><dd>{computeText(resources.ConfiguredRequests)}</dd></div>
        <div><dt>{t("manage.resources.observation.configuredLimits")}</dt><dd>{computeText(resources.ConfiguredLimits)}</dd></div>
        <div><dt>{t("manage.resources.observation.held")}</dt><dd>{observed || positive(resources.AllocatedRequests) ? computeText(resources.AllocatedRequests) : unknown()}</dd></div>
        <div><dt>{t("manage.resources.observation.used")}</dt><dd>{observed && resources.UsageAvailable ? computeText(resources.Used) : unknown()}</dd></div>
        <div><dt>{t("manage.resources.observation.released")}</dt><dd>{observed ? computeText(resources.ReleasedRequests) : unknown()}</dd></div>
        <div><dt>{t("manage.resources.observation.snapshotQuota")}</dt><dd>{observed || resources.SnapshotQuotaBytes !== "0" ? decimalMemory(resources.SnapshotQuotaBytes) : unknown()}</dd></div>
        <div><dt>{t("manage.resources.observation.physicalStorage")}</dt><dd>{observed && resources.PhysicalStorageBytesAvailable ? decimalMemory(resources.PhysicalStorageBytes) : unknown()}</dd></div>
        <div><dt>{t("manage.resources.observation.runtime")}</dt><dd>{t(`manage.resources.observation.runtime.${observed ? resources.RuntimeState : "Unknown"}`)}</dd></div>
        <div><dt>{t("manage.resources.observation.storage")}</dt><dd>{t(`manage.resources.observation.storage.${observed ? resources.StorageState : "Unknown"}`)}</dd></div>
    </dl>;
}

export function ResourceObservationFacts({observation, stale = false}: {observation: ResourceObservation | null; stale?: boolean}) {
    if (!observation) return <EmptyState compact message={unknown()} />;
    const observed = !stale && observation.ObservedAt !== null && Number.isFinite(Date.parse(observation.ObservedAt));
    const complete = observation.Complete && observed;
    return <section className="event-manage-section" aria-label={t("manage.resources.observation.title")}>
        <h2>{t("manage.resources.observation.title")}</h2>
        <p role="status">{t(complete ? "manage.resources.observation.complete" : "manage.resources.observation.incomplete")}</p>
        {!complete && <p>{t("manage.resources.observation.unknownContributors")}</p>}
        <dl className="event-resources__facts">
            <div><dt>{t("manage.resources.observation.held")}</dt><dd data-testid="observation-held">{complete || positive(observation.Held) ? computeText(observation.Held) : unknown()}</dd></div>
            <div><dt>{t("manage.resources.observation.pendingStarts")}</dt><dd>{complete || positive(observation.PendingStarts) ? computeText(observation.PendingStarts) : unknown()}</dd></div>
            <div><dt>{t("manage.resources.observation.groupServices")}</dt><dd>{complete || positive(observation.GroupServices) ? computeText(observation.GroupServices) : unknown()}</dd></div>
            <div><dt>{t("manage.resources.observation.snapshotQuota")}</dt><dd>{complete || observation.Held.SnapshotQuotaBytes !== "0" ? decimalMemory(observation.Held.SnapshotQuotaBytes) : unknown()}</dd></div>
            <div><dt>{t("manage.resources.observation.physicalStorage")}</dt><dd>{observed && observation.PhysicalStorageBytesAvailable ? decimalMemory(observation.PhysicalStorageBytes) : unknown()}</dd></div>
        </dl>
    </section>;
}
