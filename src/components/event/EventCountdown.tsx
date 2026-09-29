"use client";

import {useEffect, useState} from "react";
import {countdownParts, countdownPhase, nextPhaseChange, type CountdownSchedule} from "@/utils/eventCountdown";
import {t, tPlural} from "@/i18n/t";

const pad = (value: number) => String(value).padStart(2, "0");
const MAX_TIMEOUT = 2_000_000_000;

// The compact countdown at the top of «Завдання» and «Результати»: «До старту»
// before the start, «До завершення» during the last minutes before the finish,
// «Захід завершено» after it. It follows the schedule by itself: it ticks each
// second while a time is shown and otherwise sleeps until the next boundary.
// `hint` is the line under the start label; `showFinished` = false leaves the
// end state to the page (the challenges page has its own finished banner).
export function EventCountdown({event, hint, showFinished = true}: {event: CountdownSchedule; hint?: string; showFinished?: boolean}) {
    const [now, setNow] = useState(() => Date.now());
    const phase = countdownPhase(event, now);
    const kind = phase?.kind;
    const next = nextPhaseChange(event, now);
    useEffect(() => {
        if (kind === "start" || kind === "finish") {
            const id = setInterval(() => setNow(Date.now()), 1000);
            return () => clearInterval(id);
        }
        if (next === null) return;
        const id = setTimeout(() => setNow(Date.now()), Math.min(next - Date.now() + 50, MAX_TIMEOUT));
        return () => clearTimeout(id);
    }, [kind, next]);

    if (!phase) return null;
    if (phase.kind === "finished") {
        if (!showFinished) return null;
        return <div className="event-countdown event-countdown--finished" role="status"><span className="event-countdown__label">{t("countdown.finished")}</span></div>;
    }
    const parts = countdownParts(phase.target, now);
    const cells = [
        ...(parts.days > 0 ? [{key: "days", value: String(parts.days), label: tPlural("content.countdown.days", parts.days)}] : []),
        {key: "hours", value: pad(parts.hours), label: tPlural("content.countdown.hours", parts.hours)},
        {key: "minutes", value: pad(parts.minutes), label: tPlural("content.countdown.minutes", parts.minutes)},
        {key: "seconds", value: pad(parts.seconds), label: tPlural("content.countdown.seconds", parts.seconds)},
    ];
    const label = t(phase.kind === "start" ? "countdown.start" : "countdown.finish");
    return <section className={`event-countdown event-countdown--${phase.kind}`} aria-label={label}>
        <div className="event-countdown__text">
            <span className="event-countdown__label">{label}</span>
            {phase.kind === "start" && hint && <span className="event-countdown__hint">{hint}</span>}
        </div>
        <div className="event-countdown__clock" role="timer" aria-live="off" aria-label={cells.map(cell => `${cell.value} ${cell.label}`).join(", ")}>
            {cells.map(cell => <div className="event-countdown__cell" key={cell.key} aria-hidden="true"><strong>{cell.value}</strong><span>{cell.label}</span></div>)}
        </div>
    </section>;
}
