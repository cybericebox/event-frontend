"use client";

import {useQuery} from "@tanstack/react-query";
import {getHintUnlocks} from "@/api/manageChallenges";
import {EventLoading} from "@/components/event/EventLoading";
import {hintCostLabel} from "@/components/event/challenges/hintModel";
import {useManager} from "../ManagerShell";

function timestamp(value: string) {
    return new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"}).format(new Date(value));
}

// Who opened which hint, when and for how much (newest first).
export function HintUnlocksList() {
    const {event} = useManager();
    const teamMode = event.Participation === 1;
    const unlocks = useQuery({queryKey: ["event-hint-unlocks", event.EventID], queryFn: () => getHintUnlocks(event.EventID), refetchInterval: 30_000, refetchOnWindowFocus: false});
    if (unlocks.isPending) return <EventLoading event={event} />;
    if (unlocks.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити підказки</h1><button className="ib-btn" type="button" onClick={() => void unlocks.refetch()}>Повторити</button></div>;
    return <section className="event-manage-section event-hint-unlocks" aria-label="Відкриті підказки">
        {unlocks.data.length === 0 ? <p className="event-challenge-manager__empty">Підказки ще не відкривали.</p> : <div className="event-participants-table"><table>
            <thead><tr><th>Час</th><th>{teamMode ? "Команда" : "Учасник"}</th><th>Завдання</th><th>Підказка</th>{teamMode && <th>Відкрито</th>}<th>Вартість</th></tr></thead>
            <tbody>{unlocks.data.map(item => <tr key={`${item.TeamID}-${item.HintID}`}>
                <td><time dateTime={item.UnlockedAt}>{timestamp(item.UnlockedAt)}</time></td>
                <td>{item.TeamName}</td>
                <td>{item.ChallengeName || "Завдання"}</td>
                <td>Підказка {item.HintIndex + 1}</td>
                {teamMode && <td>{item.UnlockedByName || "—"}</td>}
                <td className="ib-num">{hintCostLabel(item.Cost)}</td>
            </tr>)}</tbody>
        </table></div>}
    </section>;
}
