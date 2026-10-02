"use client";

import {useQuery} from "@tanstack/react-query";
import {getEventResourcePlan, type EventExerciseAttachment} from "@/api/manageChallenges";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t} from "@/i18n/t";
import {ResourceHeavyTag} from "./ResourceMarks";
import {formatCpu, formatMemory, overheadText, planTotals} from "./resourceModel";

// The resources one team's lab group reserves: the largest variant of each set, the group overhead
// (VPN, gateway) as a separate line, and the total. Shown only when the event has sets with devices.
export function ResourcePlanSummary({eventID, attachments}: {eventID: string; attachments: EventExerciseAttachment[]}) {
    const withResources = attachments.filter(attachment => attachment.Resources !== null);
    const plan = useQuery({queryKey: ["event-resource-plan", eventID], queryFn: () => getEventResourcePlan(eventID), enabled: withResources.length > 0, refetchOnWindowFocus: false, retry: false});
    if (withResources.length === 0) return null;
    const totals = plan.data ? planTotals(attachments, plan.data) : null;
    return <section className="event-resource-plan" aria-label={t("manage.resources.planTitle")}>
        <h3>{t("manage.resources.planTitle")}</h3>
        <p className="event-resource-plan__note">{t("manage.resources.planNote")}</p>
        {plan.isPending ? <EventLoading compact label={t("manage.resources.planLoading")} />
            : plan.isError || !totals ? <EventLoadError compact message={t("manage.resources.planFailed")} error={plan.error} onRetry={() => void plan.refetch()} />
            : <table className="event-resource-plan__table">
                <thead><tr><th scope="col">{t("manage.resources.col.task")}</th><th scope="col">{t("manage.resources.col.cpu")}</th><th scope="col">{t("manage.resources.col.memory")}</th><th scope="col">{t("manage.resources.col.devices")}</th></tr></thead>
                <tbody>
                    {totals.lines.map(line => <tr key={line.id} data-plan-task>
                        <th scope="row">{line.name} <ResourceHeavyTag show={line.heavy} /></th>
                        <td>{formatCpu(line.resources.CPUMillicores)}</td><td>{formatMemory(line.resources.MemoryBytes)}</td><td>{line.resources.Devices}</td>
                    </tr>)}
                    <tr data-plan-overhead className="event-resource-plan__overhead">
                        <th scope="row">{t("manage.resources.overhead")}</th>
                        <td colSpan={3}>{overheadText(totals.overhead)} <span>{t("manage.resources.overheadHint", {vpn: overheadText(plan.data.Overhead.VPN), gateway: overheadText(plan.data.Overhead.Gateway)})}</span></td>
                    </tr>
                </tbody>
                <tfoot><tr data-plan-total>
                    <th scope="row">{t("manage.resources.total")}</th>
                    <td>{formatCpu(totals.total.CPUMillicores)}</td><td>{formatMemory(totals.total.MemoryBytes)}</td><td>{totals.total.Devices}</td>
                </tr></tfoot>
            </table>}
    </section>;
}
