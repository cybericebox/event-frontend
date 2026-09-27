"use client";

import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {getManageResults} from "@/api/manageResults";
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
    const canViewResults = participant?.participantInfo.CanViewResults ?? event?.CanViewResults ?? false;
    const [now, setNow] = useState(() => Date.now());
    const started = !!event && Date.parse(event.StartTime) <= now;
    useEffect(() => {
        if (started) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [started]);
    const results = useQuery({
        queryKey: ["event-public-results", event?.EventID],
        queryFn: () => getManageResults(event!.EventID),
        enabled: !!event && canViewResults && started,
        retry: false,
        refetchInterval: 30000,
    });

    if (!event) return <EventLoading label="Завантажуємо рейтинг…" />;
    if (!canViewResults) return <Centered><p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Рейтинг приховано організатором</p></Centered>;
    if (!started) return <Centered><CountdownTimer text="Рейтинг з'явиться після старту" until={new Date(event.StartTime)} /></Centered>;
    if (results.isPending) return <EventLoading label="Завантажуємо результати…" />;
    if (results.isError) return <Centered><p className="text-sm text-destructive">Не вдалося завантажити рейтинг.</p></Centered>;
    if (!results.data.Scoreboard.length) return <Centered><p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Ще немає результатів</p></Centered>;

    return <div className="mx-auto w-full max-w-screen-2xl">
        <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Динаміка балів · топ-5</p>
            <ScoreChart snapshot={results.data} startTime={new Date(event.StartTime)} finishTime={event.FinishTime ? new Date(event.FinishTime) : new Date(Math.max(now, Date.parse(event.StartTime) + 3600000))} />
        </div>
        <ScoreTable snapshot={results.data} ownTeamID={participant?.ownTeam?.ID} />
    </div>;
}
