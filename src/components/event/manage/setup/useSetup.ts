import {useQuery} from "@tanstack/react-query";
import {getManageConfig, getManageContent, getManageLifecycle} from "@/api/manage";
import {getEventExerciseAttachments} from "@/api/manageChallenges";
import {getEventMailSettings} from "@/api/manageMail";
import {buildSetupSteps, summarizeSetup, type SetupStep, type SetupSummary} from "./setupModel";

// The setup state of an event, read from the same queries the manage pages use.
// It is null until everything has answered; a part that failed only drops its step.
export function useSetup(eventID: string): {steps: SetupStep[]; summary: SetupSummary} | null {
    const options = {refetchOnWindowFocus: false};
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), ...options});
    const lifecycle = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), ...options});
    const attachments = useQuery({queryKey: ["event-exercise-attachments", eventID], queryFn: () => getEventExerciseAttachments(eventID), ...options});
    const content = useQuery({queryKey: ["event-management-content", eventID], queryFn: () => getManageContent(eventID), ...options});
    const mail = useQuery({queryKey: ["event-manage-mail", eventID], queryFn: () => getEventMailSettings(eventID), ...options});
    if (!config.data || !lifecycle.data) return null;
    if ([attachments, content, mail].some(query => query.isPending)) return null;
    const steps = buildSetupSteps({config: config.data, lifecycle: lifecycle.data, attachments: attachments.data, content: content.data, mail: mail.data});
    return {steps, summary: summarizeSetup(steps)};
}
