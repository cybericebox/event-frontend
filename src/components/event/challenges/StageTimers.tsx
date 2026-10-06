"use client";

import {useEffect, useRef, useState} from "react";
import type {OwnBoard} from "@/api/participantChallenges";
import {CountdownClock} from "@/components/event/EventCountdown";
import {t} from "@/i18n/t";
import {formatClock} from "./challengeBoardModel";

// The stage timers of the board header, next to the event timer: inside a stage whose countdown is visible,
// «Етап «…» · Залишилось у етапі»; during a break, «Перерва до …». They count against the server's clock
// (ServerNow, carried by the offset), never the browser's own.
export function StageTimers({board, offset, onZero}: {board: Pick<OwnBoard, "CurrentStage" | "NextOpensAt">; offset: number; onZero: () => void}) {
    const stage = board.CurrentStage;
    const target = stage?.EndsAt ?? board.NextOpensAt;
    const targetMs = target ? Date.parse(target) : NaN;
    const [now, setNow] = useState(() => Date.now() + offset);
    const ticking = Number.isFinite(targetMs);
    // onZero fires once per target: the refetch it triggers moves the target on.
    const firedFor = useRef<number | null>(null);
    useEffect(() => {
        if (!ticking) return;
        const tick = () => {
            const current = Date.now() + offset;
            setNow(current);
            if (current >= targetMs && firedFor.current !== targetMs) { firedFor.current = targetMs; onZero(); }
        };
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [ticking, targetMs, offset, onZero]);
    if (!ticking || !target) return null;
    if (stage?.EndsAt) {
        return <section className="event-countdown event-countdown--stage" aria-label={t("challenges.stage.timerAria")}>
            <div className="event-countdown__text">
                <span className="event-countdown__label">{t("challenges.stage.name", {name: stage.Name})}</span>
                <span className="event-countdown__hint">{t("challenges.stage.remaining")}</span>
            </div>
            <CountdownClock target={targetMs} now={now} label={t("challenges.stage.remaining")} />
        </section>;
    }
    const label = t("challenges.stage.break", {time: formatClock(target)});
    return <section className="event-countdown event-countdown--break" aria-label={label}>
        <div className="event-countdown__text"><span className="event-countdown__label">{label}</span></div>
        <CountdownClock target={targetMs} now={now} label={label} />
    </section>;
}
