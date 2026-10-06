import {useQuery} from "@tanstack/react-query";
import {getManageConfig, getManageContent, getManageLifecycle} from "@/api/manage";
import {getEventExerciseAttachments} from "@/api/manageChallenges";
import {getManageResources} from "@/api/manageResources";
import {useBoardSets} from "../exercises/useBoardSets";
import {getEventMailSettings} from "@/api/manageMail";
import {buildSetupSteps, summarizeSetup, type SetupStep, type SetupSummary} from "./setupModel";

// The setup state of an event, read from the same queries the manage pages use.
// It is null until everything has answered; a part that failed only drops its step.
// withHints also reads the tasks of every set (the checklist page only; the top bar skips that load).
export function useSetup(eventID: string, withHints = false): {steps: SetupStep[]; summary: SetupSummary} | null {
    const options = {refetchOnWindowFocus: false};
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), ...options});
    const lifecycle = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), ...options});
    const attachments = useQuery({queryKey: ["event-exercise-attachments", eventID], queryFn: () => getEventExerciseAttachments(eventID), ...options});
    const content = useQuery({queryKey: ["event-management-content", eventID], queryFn: () => getManageContent(eventID), ...options});
    const mail = useQuery({queryKey: ["event-manage-mail", eventID], queryFn: () => getEventMailSettings(eventID), ...options});
    const infrastructure = !!config.data?.InfrastructureAllowed && (attachments.data ?? []).some(item => item.Status === 0 && item.Infrastructure);
    // A failed or missing reservation read only drops its step.
    const resources = useQuery({queryKey: ["event-management-resources", eventID], queryFn: () => getManageResources(eventID), enabled: infrastructure, retry: false, ...options});
    const board = useBoardSets(eventID, {enabled: withHints});
    if (!config.data || !lifecycle.data) return null;
    if ([attachments, content, mail].some(query => query.isPending)) return null;
    if (infrastructure && resources.isPending) return null;
    if (withHints && board.sets.isPending) return null;
    const challenges = withHints && board.sets.data ? board.sets.data.flatMap(set => set.challenges) : undefined;
    const steps = buildSetupSteps({config: config.data, lifecycle: lifecycle.data, attachments: attachments.data, content: content.data, mail: mail.data, resources: resources.data, challenges});
    return {steps, summary: summarizeSetup(steps)};
}
