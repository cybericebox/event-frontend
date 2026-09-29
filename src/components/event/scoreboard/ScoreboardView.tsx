"use client";

import {useEffect, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getManageResults, resultsLiveURL, ResultsUnavailableError, type ManageResultsSnapshot} from "@/api/manageResults";
import {resultsAvailability, type ResultsAvailability} from "@/types/resultsAvailability";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {CountdownTimer} from "@/components/Countdown";
import {EventLoading} from "@/components/event/EventLoading";
import {EventBanner} from "@/components/event/EventBanner";
import {useEventStream} from "@/utils/eventStream";
import {frozenBannerTitle, frozenSinceLabel, nextFreezeBoundary} from "@/utils/resultsFreeze";
import {chartTeamIDs, unitCount} from "./scoreboardModel";
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
    const queryClient = useQueryClient();
    const queryKey = ["event-public-results", event?.EventID];
    const revision = queryClient.getQueryData<ManageResultsSnapshot>(queryKey)?.Revision;
    // Realtime: every change reloads the snapshot (the server applies the
    // freeze); 30 s polling only when the stream keeps failing.
    const stream = useEventStream({
        url: () => event && revision !== undefined ? resultsLiveURL(event.EventID, revision) : null,
        events: ["result-change"], resetEvents: ["snapshot-required"],
        onChange: () => void queryClient.invalidateQueries({queryKey}),
        enabled: !!event && readable && revision !== undefined,
    });
    const results = useQuery({
        queryKey,
        queryFn: () => getManageResults(event!.EventID),
        enabled: !!event && readable,
        retry: false,
        refetchInterval: stream === "fallback" ? 30000 : false,
    });
    // The freeze starts and ends by the clock: reload right after each boundary.
    const freeze = results.data?.Freeze;
    const refetch = results.refetch;
    useEffect(() => {
        if (!freeze) return;
        const delay = nextFreezeBoundary(freeze, Date.now());
        if (delay === null || delay > 2_147_000_000) return;
        const id = setTimeout(() => void refetch(), delay + 1000);
        return () => clearTimeout(id);
    }, [freeze, refetch]);

    if (!event) return <EventLoading label="Завантажуємо рейтинг…" />;
    const denied: ResultsAvailability | null = !readable ? availability : results.error instanceof ResultsUnavailableError ? results.error.reason : null;
    if (denied === "hidden") return <Centered><p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Рейтинг приховано організатором</p></Centered>;
    if (denied === "participants_only") return <Centered><p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Рейтинг доступний лише учасникам</p></Centered>;
    if (denied === "not_started") return <Centered>{started ? <p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Рейтинг з&apos;явиться після старту</p> : <CountdownTimer text="Рейтинг з'явиться після старту" until={new Date(event.StartTime)} />}</Centered>;
    if (results.isPending) return <EventLoading label="Завантажуємо результати…" />;
    if (results.isError) return <Centered><p className="text-sm text-destructive">Не вдалося завантажити рейтинг.</p></Centered>;

    const data = results.data;
    const teamMode = event.Participation === 1;
    const ownTeamID = participant?.ownTeam?.ID;
    const ownRow = !!ownTeamID && data.Scoreboard.some(entry => entry.TeamID === ownTeamID);
    const frozen = data.Freeze.Applied;
    const chartEnd = Math.max(Date.parse(event.StartTime) + 60000, Math.min(event.FinishTime ? Date.parse(event.FinishTime) : Number.POSITIVE_INFINITY, now));
    const sub = `${unitCount(data.TotalTeams, teamMode)} · ${frozen ? "рейтинг заморожено" : stream === "fallback" ? "оновлюється кожні 30 с" : "оновлюється наживо"}`;
    const trimmed = data.Display.RowsLimit !== null && data.TotalTeams > data.Display.RowsLimit;

    return <div className="event-results">
        {frozen && <div className="ib-banner-stack event-results__banners"><EventBanner tone="warning" title={frozenBannerTitle(data.Freeze)} meta={frozenSinceLabel(data.Freeze)} message="Таблиця показує стан на момент заморожування. Підсумки — після фіналу." /></div>}
        <header className="ib-page-header">
            <div className="ib-page-header__top"><div className="ib-page-header__heading"><h1 className="ib-page-header__title">Результати</h1><p className="ib-page-header__sub">{sub}</p></div></div>
        </header>
        {data.Scoreboard.length === 0 ? <Centered><p className="rounded-lg border border-border bg-card p-8 text-center text-foreground">Ще немає результатів</p></Centered> : <>
            {data.Display.ChartEnabled && <div className="event-results__chart rounded-lg border border-border bg-card p-4">
                <p className="mb-2 text-sm font-semibold text-foreground">Бали за часом · топ-{Math.min(data.Display.ChartTeams, data.Scoreboard.length)}{ownRow ? (teamMode ? " і ваша команда" : " і ви") : ""}</p>
                <ScoreChart snapshot={data} teamIDs={chartTeamIDs(data, ownTeamID)} ownTeamID={ownTeamID} startTime={new Date(event.StartTime)} finishTime={new Date(chartEnd)} />
            </div>}
            <ScoreTable snapshot={data} ownTeamID={ownTeamID} teamMode={teamMode} />
            {(frozen && ownRow || trimmed) && <p className="ib-ranking-note">
                {frozen && ownRow && (teamMode ? "Бали вашої команди оновлюються, місце — на момент заморожування." : "Ваші бали оновлюються, місце — на момент заморожування.")}
                {frozen && ownRow && trimmed && " "}
                {trimmed && `Показано перші ${data.Display.RowsLimit} з ${data.TotalTeams}.`}
            </p>}
        </>}
    </div>;
}
