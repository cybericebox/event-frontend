"use client";

import {useQuery} from "@tanstack/react-query";
import {getHintUnlocks} from "@/api/manageChallenges";
import {EventLoading} from "@/components/event/EventLoading";
import {hintCostLabel} from "@/components/event/challenges/hintModel";
import {useManager} from "../ManagerShell";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";

function timestamp(value: string) {
    return new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"}).format(new Date(value));
}

// Who opened which hint, when and for how much (newest first).
export function HintUnlocksList() {
    const {event} = useManager();
    const teamMode = event.Participation === 1;
    const unlocks = useQuery({queryKey: ["event-hint-unlocks", event.EventID], queryFn: () => getHintUnlocks(event.EventID), refetchInterval: 30_000, refetchOnWindowFocus: false});
    if (unlocks.isPending) return <EventLoading event={event} />;
    if (unlocks.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.exercises.unlocks.loadFailed")}</h1><button className="ib-btn" type="button" onClick={() => void unlocks.refetch()}>{t("common.retry")}</button></div>;
    return <section className="event-manage-section event-hint-unlocks" aria-label={t("manage.exercises.tabs.unlocks")}>
        {unlocks.data.length === 0 ? <EmptyState message={t("manage.exercises.unlocks.empty")} /> : <div className="event-participants-table"><table>
            <thead><tr><th>{t("manage.exercises.unlocks.time")}</th><th>{teamMode ? t("manage.exercises.unlocks.team") : t("manage.exercises.unlocks.participant")}</th><th>{t("manage.exercises.unlocks.challenge")}</th><th>{t("manage.exercises.unlocks.hint")}</th>{teamMode && <th>{t("manage.exercises.unlocks.openedBy")}</th>}<th>{t("manage.exercises.unlocks.cost")}</th></tr></thead>
            <tbody>{unlocks.data.map(item => <tr key={`${item.TeamID}-${item.HintID}`}>
                <td><time dateTime={item.UnlockedAt}>{timestamp(item.UnlockedAt)}</time></td>
                <td>{item.TeamName}</td>
                <td>{item.ChallengeName || t("manage.exercises.unlocks.challenge")}</td>
                <td>{t("manage.exercises.unlocks.hintNumber", {number: item.HintIndex + 1})}</td>
                {teamMode && <td>{item.UnlockedByName || "—"}</td>}
                <td className="ib-num">{hintCostLabel(item.Cost)}</td>
            </tr>)}</tbody>
        </table></div>}
    </section>;
}
