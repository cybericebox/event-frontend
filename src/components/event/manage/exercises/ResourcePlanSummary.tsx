"use client";

import {useQuery} from "@tanstack/react-query";
import {getEventResourcePlan, type EventExerciseAttachment} from "@/api/manageChallenges";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t} from "@/i18n/t";
import {NoAgentFitsTag, ResourceHeavyTag} from "./ResourceMarks";
import {amountText, formatCpu, formatMemory, hasResources} from "./resourceModel";

// The resources the event reserves: per task the largest variant, the lab group's own pods (VPN, gateway)
// as a separate line, the total per team and for all teams. Shown only when the event has sets with devices.
export function ResourcePlanSummary({eventID, attachments}: {eventID: string; attachments: EventExerciseAttachment[]}) {
    const needed = attachments.some(attachment => hasResources(attachment.Resources));
    const query = useQuery({queryKey: ["event-resource-plan", eventID], queryFn: () => getEventResourcePlan(eventID), enabled: needed, refetchOnWindowFocus: false, retry: false});
    if (!needed) return null;
    const plan = query.data;
    return <section className="event-resource-plan" aria-label={t("manage.resources.planTitle")}>
        <h3>{t("manage.resources.planTitle")}</h3>
        <p className="event-resource-plan__note">{t("manage.resources.planNote")}</p>
        {query.isPending ? <EventLoading compact label={t("manage.resources.planLoading")} />
            : query.isError || !plan ? <EventLoadError compact message={t("manage.resources.planFailed")} error={query.error} onRetry={() => void query.refetch()} />
            : <>
                {plan.NoAgentFits && <p className="event-manage-feedback event-manage-feedback--error" role="alert" data-plan-no-agent>{t("manage.resources.planNoAgentFits")}</p>}
                <table className="event-resource-plan__table">
                    <thead><tr><th scope="col">{t("manage.resources.col.task")}</th><th scope="col">{t("manage.resources.col.cpu")}</th><th scope="col">{t("manage.resources.col.memory")}</th><th scope="col">{t("manage.resources.col.blocks")}</th><th scope="col">{t("manage.resources.col.devices")}</th></tr></thead>
                    <tbody>
                        {plan.Tasks.map(task => <tr key={task.EventExerciseID} data-plan-task>
                            <th scope="row">{task.ExerciseName} <ResourceHeavyTag show={task.ResourceHeavy} /> <NoAgentFitsTag show={task.NoAgentFits} /></th>
                            <td>{formatCpu(task.Reserved.CPUMillicores)}</td><td>{formatMemory(task.Reserved.MemoryBytes)}</td><td>{task.Reserved.Blocks}</td><td>{task.Reserved.Devices}</td>
                        </tr>)}
                        <tr data-plan-overhead className="event-resource-plan__overhead">
                            <th scope="row">{t("manage.resources.overhead")}</th>
                            {plan.Group.Known
                                ? <td colSpan={4}><span>{t("manage.resources.overheadHint", {vpn: amountText(plan.Group.VPN), gateway: amountText(plan.Group.Gateway), users: plan.Group.MaxUsers, labs: plan.Group.InternetLabs})}</span></td>
                                : <td colSpan={4} data-overhead-unknown>{t("manage.resources.overheadUnknown")}</td>}
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr data-plan-team><th scope="row">{t("manage.resources.perTeam")}</th>
                            <td>{formatCpu(plan.PerTeam.CPUMillicores)}</td><td>{formatMemory(plan.PerTeam.MemoryBytes)}</td><td>{plan.PerTeam.Blocks}</td><td>{plan.PerTeam.Devices}</td></tr>
                        <tr data-plan-total><th scope="row">{t("manage.resources.total", {teams: plan.Teams})} <span className="event-resource-plan__basis">{t(`manage.resources.basis.${plan.TeamsBasis}`)}</span></th>
                            <td>{formatCpu(plan.Total.CPUMillicores)}</td><td>{formatMemory(plan.Total.MemoryBytes)}</td><td>{plan.Total.Blocks}</td><td>{plan.Total.Devices}</td></tr>
                    </tfoot>
                </table>
                {plan.Group.TooLarge && <p className="event-resource-plan__note" role="status" data-plan-too-large>{t("manage.resources.tooLarge")}</p>}
            </>}
    </section>;
}
