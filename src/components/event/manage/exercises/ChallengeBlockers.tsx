"use client";

import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {getManageConfig, getManageLifecycle} from "@/api/manage";
import {getEventExerciseAttachments} from "@/api/manageChallenges";
import {t} from "@/i18n/t";
import {infrastructureMismatch} from "./attachmentModel";
import "./challengesManage.css";

// Blocking issues of the challenges for the overview: sets that need
// infrastructure on an event without it. Nothing while loading or fine.
export function ChallengeBlockers({eventID}: {eventID: string}) {
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const lifecycle = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const attachments = useQuery({queryKey: ["event-exercise-attachments", eventID], queryFn: () => getEventExerciseAttachments(eventID), refetchOnWindowFocus: false});
    if (!config.data || !attachments.data || !lifecycle.data) return null;
    const published = lifecycle.data.Status !== "not_published";
    const blocked = attachments.data.filter(item => item.Status === 0 && infrastructureMismatch(item, config.data.InfrastructureAllowed));
    if (blocked.length === 0) return null;
    return <section className="event-manage-blockers" role="alert" aria-labelledby="manage-blockers-title">
        <h2 id="manage-blockers-title">{t("manage.challenges.blockers.title")}</h2>
        <p>{t(published ? "manage.challenges.set.infraMissingAfter" : "manage.challenges.set.infraMissingBefore")}</p>
        <ul>{blocked.map(item => <li key={item.ID}>{t("manage.challenges.blockers.infraMissing", {name: item.ExerciseName || t("manage.exercises.set")})} <Link href="/manage/exercises">{t("manage.challenges.blockers.open")}</Link></li>)}</ul>
    </section>;
}
