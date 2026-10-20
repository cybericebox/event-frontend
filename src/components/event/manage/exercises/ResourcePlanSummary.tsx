"use client";

import {useId, useState} from "react";
import {ChevronRight} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {getEventResourcePlan, type EventExerciseAttachment} from "@/api/manageChallenges";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t, tPlural} from "@/i18n/t";
import {NoAgentFitsTag, ResourceHeavyTag} from "./ResourceMarks";
import {amountText, formatCpu, formatMemory, hasResources} from "./resourceModel";

// The resources the event reserves: per task the largest variant, the lab group's own pods (VPN, gateway)
// as a separate line, the total per team and for all teams. Shown only when the event has sets with devices.
export function ResourcePlanSummary({eventID, attachments}: {eventID: string; attachments: EventExerciseAttachment[]}) {
    const needed = attachments.some(attachment => hasResources(attachment.Resources));
    const bodyID = useId();
    const query = useQuery({queryKey: ["event-resource-plan", eventID], queryFn: () => getEventResourcePlan(eventID), enabled: needed, refetchOnWindowFocus: false, retry: false});
    const [open, setOpen] = useState(false);
    if (!needed) return null;
    const plan = query.data;
    return <section className="event-resource-plan" aria-label={t("manage.resources.planTitle")}>
        {/* Collapsed by default: the header carries the per-team total in one line. */}
        <h3><button type="button" className="event-resource-plan__toggle" aria-expanded={open} aria-controls={bodyID} onClick={() => setOpen(value => !value)}>
            <ChevronRight className="event-resource-plan__chevron" size={16} aria-hidden="true" />
            <span>{t("manage.resources.planTitle")}</span>
            {plan && <span className="event-resource-plan__summary">{t("manage.resources.planSummary", {cpu: formatCpu(plan.PerTeam.CPUMillicores), memory: formatMemory(plan.PerTeam.MemoryBytes), devices: plan.PerTeam.Devices})}</span>}
        </button></h3>
        {plan?.NoAgentFits && <p className="event-manage-feedback event-manage-feedback--error" role="alert" data-plan-no-agent>{t("manage.resources.planNoAgentFits")}</p>}
        {query.isError && !plan && <EventLoadError compact message={t("manage.resources.planFailed")} error={query.error} onRetry={() => void query.refetch()} />}
        {open && <div className="event-resource-plan__body" id={bodyID}>
        <p className="event-resource-plan__note">{t("manage.resources.planNote")}</p>
        {query.isPending ? <EventLoading compact label={t("manage.resources.planLoading")} />
            : !plan ? null
            : <>
                <div className="event-resource-plan__scroll" role="region" tabIndex={0} aria-label={t("manage.resources.planTitle")}><table className="event-resource-plan__table">
                    {/* One set of column widths for every row: the numbers line up under their headers. */}
                    <colgroup><col className="event-resource-plan__name-col" /><col /><col /><col /></colgroup>
                    <thead><tr><th scope="col">{t("manage.resources.col.task")}</th><th scope="col" className="ib-num">{t("manage.resources.col.cpu")}</th><th scope="col" className="ib-num">{t("manage.resources.col.memory")}</th><th scope="col" className="ib-num">{t("manage.resources.col.devices")}</th></tr></thead>
                    <tbody>
                        {plan.Tasks.map(task => <tr key={task.EventExerciseID} data-plan-task>
                            <th scope="row">{task.ExerciseName} <ResourceHeavyTag show={task.ResourceHeavy} /> <NoAgentFitsTag show={task.NoAgentFits} /></th>
                            <td className="ib-num">{formatCpu(task.Reserved.CPUMillicores)}</td><td className="ib-num">{formatMemory(task.Reserved.MemoryBytes)}</td><td className="ib-num">{task.Reserved.Devices}</td>
                        </tr>)}
                        <tr data-plan-overhead className="event-resource-plan__overhead">
                            <th scope="row">{t("manage.resources.overhead")}</th>
                            {plan.Group.Known
                                ? <td colSpan={3}><span>{t("manage.resources.overheadHint", {vpn: amountText(plan.Group.VPN), gateway: amountText(plan.Group.Gateway), users: plan.Group.MaxUsers, labs: plan.Group.InternetLabs})}</span></td>
                                : <td colSpan={3} data-overhead-unknown>{t("manage.resources.overheadUnknown")}</td>}
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr data-plan-team><th scope="row">{t("manage.resources.perTeam")}</th>
                            <td className="ib-num">{formatCpu(plan.PerTeam.CPUMillicores)}</td><td className="ib-num">{formatMemory(plan.PerTeam.MemoryBytes)}</td><td className="ib-num">{plan.PerTeam.Devices}</td></tr>
                        <tr data-plan-total><th scope="row">{tPlural("manage.resources.total", plan.Teams)} <span className="event-resource-plan__basis">{t(`manage.resources.basis.${plan.TeamsBasis}`)}</span></th>
                            <td className="ib-num">{formatCpu(plan.Total.CPUMillicores)}</td><td className="ib-num">{formatMemory(plan.Total.MemoryBytes)}</td><td className="ib-num">{plan.Total.Devices}</td></tr>
                    </tfoot>
                </table></div>
                {plan.Group.TooLarge && <p className="event-resource-plan__note" role="status" data-plan-too-large>{t("manage.resources.tooLarge")}</p>}
            </>}
        </div>}
    </section>;
}
