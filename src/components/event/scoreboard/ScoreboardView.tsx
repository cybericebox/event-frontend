"use client";

import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {getManageResults, ResultsUnavailableError} from "@/api/manageResults";
import {resultsAvailability, type ResultsAvailability} from "@/types/resultsAvailability";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {CountdownTimer} from "@/components/Countdown";
import {EventLoading} from "@/components/event/EventLoading";
import {ScoreChart} from "./ScoreChart";
import {ScoreTable} from "./ScoreTable";

function Centered({children}: {children: React.ReactNode}) {
    return <div className="flex min-h-[40vh] items-center justify-center">{children}</div>;
}

export function ScoreboardView() {
    const participant = useParticipantContext();
    const guestEvent = useGuestEvent();
    const event = participant?.event ?? guestEvent;
    const availability = participant ? resultsAvailability(participant.participantInfo) : event ? resultsAvailability(event) : "hidden";
    const [now, setNow] = useState(() => Date.now());
    const started = !!event && Date.parse(event.StartTime) <= now;
    // "not_started" opens by itself at the start; the others need the organizer.
    const readable = availability === "available" || (availability === "not_started" && started);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), started ? 30000 : 1000);
        return () => clearInterval(id);
    }, [started]);
    const results = useQuery({
        queryKey: ["event-public-results", event?.EventID],
        queryFn: () => getManageResults(event!.EventID),
        enabled: !!event && readable,
        retry: false,
        refetchInterval: 30000,
    });

    if (!event) return <EventLoading label="Завантажуємо рейтинг…" />;
    const denied: ResultsAvailability | null = !readable ? availability : results.error instanceof ResultsUnavailableError ? results.error.reason : null;
    if (denied === "hidden") return <Centered><p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Рейтинг приховано організатором</p></Centered>;
    if (denied === "participants_only") return <Centered><p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Рейтинг доступний лише учасникам</p></Centered>;
    if (denied === "not_started") return <Centered>{started ? <p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Рейтинг з&apos;явиться після старту</p> : <CountdownTimer text="Рейтинг з'явиться після старту" until={new Date(event.StartTime)} />}</Centered>;
    if (results.isPending) return <EventLoading label="Завантажуємо результати…" />;
    if (results.isError) return <Centered><p className="text-sm text-destructive">Не вдалося завантажити рейтинг.</p></Centered>;
    if (!results.data.Scoreboard.length) return <Centered><p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Ще немає результатів</p></Centered>;
    const chartEnd = Math.max(Date.parse(event.StartTime) + 60000, Math.min(event.FinishTime ? Date.parse(event.FinishTime) : Number.POSITIVE_INFINITY, now));

    return <div className="mx-auto w-full max-w-screen-2xl">
        <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Динаміка балів · топ-5</p>
            <ScoreChart snapshot={results.data} startTime={new Date(event.StartTime)} finishTime={new Date(chartEnd)} />
        </div>
        <ScoreTable snapshot={results.data} ownTeamID={participant?.ownTeam?.ID} teamMode={event.Participation === 1} />
    </div>;
}
