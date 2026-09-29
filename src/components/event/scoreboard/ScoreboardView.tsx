"use client";

import {useEffect, useState} from "react";
import {ExternalLink} from "lucide-react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getManageResults, resultsLiveURL, ResultsUnavailableError, type ManageResultsSnapshot} from "@/api/manageResults";
import {resultsAvailability, viewerResultsAvailability, type ResultsAvailability} from "@/types/resultsAvailability";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {useStaffAccess} from "@/components/event/useStaffAccess";
import {EventLoading} from "@/components/event/EventLoading";
import {EventBanner} from "@/components/event/EventBanner";
import {useEventStream} from "@/utils/eventStream";
import {frozenBannerTitle, frozenSinceLabel, nextFreezeBoundary} from "@/utils/resultsFreeze";
import {t} from "@/i18n/t";
import {chartTeamIDs, searchScoreboard, unitCount} from "./scoreboardModel";
import {ScoreChart} from "./ScoreChart";
import {ScoreTable, type ScoreTableState} from "./ScoreTable";
import "./scoreboard.css";

const deniedMessages: Partial<Record<ResultsAvailability, string>> = {hidden: "scoreboard.hidden", participants_only: "scoreboard.participantsOnly"};

// The participant and guest «Результати»: a chart of the leaders (plus the
// viewer's own team) above a searchable ranking. The page exists in every
// phase for whoever may read the results; before the start the table block
// says when the ranking appears.
export function ScoreboardView() {
    const participant = useParticipantContext();
    const guestEvent = useGuestEvent();
    const event = participant?.event ?? guestEvent;
    const access = useStaffAccess(event?.EventID);
    const base = participant ? resultsAvailability(participant.participantInfo) : event ? resultsAvailability(event) : "hidden";
    const availability = viewerResultsAvailability(base, access.staff);
    const [now, setNow] = useState(() => Date.now());
    const [search, setSearch] = useState("");
    const started = !!event && Date.parse(event.StartTime) <= now;
    // "not_started" opens by itself at the start; the others need the organizer.
    const readable = started && (availability === "available" || availability === "not_started");
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
        enabled: !!event && readable && !access.pending,
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

    if (!event || access.pending) return <EventLoading event={event} label={t("scoreboard.loadingRanking")} />;
    const teamMode = event.Participation === 1;
    const ownTeamID = participant?.ownTeam?.ID;
    const denied: ResultsAvailability | null = results.error instanceof ResultsUnavailableError ? results.error.reason : availability === "hidden" || availability === "participants_only" ? availability : null;
    const data = !denied && started ? results.data : undefined;
    const rows = data ? searchScoreboard(data, search) : [];
    let state: ScoreTableState;
    if (denied && deniedMessages[denied]) state = {kind: "empty", message: t(deniedMessages[denied])};
    else if (!started || denied === "not_started") state = {kind: "empty", message: t("scoreboard.afterStart")};
    else if (results.isError) state = {kind: "custom", content: <EventLoadError message={t("scoreboard.loadFailed")} onRetry={() => void results.refetch()} />};
    else if (!data) state = {kind: "loading"};
    else if (data.Scoreboard.length === 0) state = {kind: "empty", message: t("scoreboard.empty")};
    else if (rows.length === 0) state = {kind: "empty", message: t("scoreboard.emptySearch")};
    else state = {kind: "rows", rows};

    const ownRow = !!data && !!ownTeamID && data.Scoreboard.some(entry => entry.TeamID === ownTeamID);
    const frozen = !!data?.Freeze.Applied;
    const chartEnd = Math.max(Date.parse(event.StartTime) + 60000, Math.min(event.FinishTime ? Date.parse(event.FinishTime) : Number.POSITIVE_INFINITY, now));
    const status = !started ? t("scoreboard.status.notStarted") : frozen ? t("scoreboard.status.frozen") : stream === "fallback" ? t("scoreboard.status.polling") : t("scoreboard.status.live");
    const sub = data ? t("scoreboard.sub", {units: unitCount(data.TotalTeams, teamMode), status}) : status;
    const trimmed = !!data && data.Display.RowsLimit !== null && data.TotalTeams > data.Display.RowsLimit;
    // The live screen opens for the event's staff only (the API serves it to them).
    const liveOpen = access.staff;

    return <div className="event-results">
        {frozen && data && <div className="ib-banner-stack event-results__banners"><EventBanner tone="warning" title={frozenBannerTitle(data.Freeze)} meta={frozenSinceLabel(data.Freeze)} message={t("scoreboard.frozenMessage")} /></div>}
        <div className="event-results__head">
            <header className="ib-page-header">
                <div className="ib-page-header__top"><div className="ib-page-header__heading"><h1 className="ib-page-header__title">{t("scoreboard.title")}</h1>{!denied && <p className="ib-page-header__sub">{sub}</p>}</div></div>
            </header>
            {liveOpen && <div className="event-results__actions"><a className="ib-btn" href="/live" target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" /> {t("scoreboard.openLive")}</a></div>}
        </div>
        {data && data.Display.ChartEnabled && data.Scoreboard.length > 0 && <div className="event-results__chart rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-sm font-semibold text-foreground">{t(ownRow ? (teamMode ? "scoreboard.chartTitleOwnTeam" : "scoreboard.chartTitleOwn") : "scoreboard.chartTitle", {top: Math.min(data.Display.ChartTeams, data.Scoreboard.length)})}</p>
            <ScoreChart snapshot={data} teamIDs={chartTeamIDs(data, ownTeamID)} ownTeamID={ownTeamID} startTime={new Date(event.StartTime)} finishTime={new Date(chartEnd)} />
        </div>}
        <ScoreTable event={event} state={state} ownTeamID={ownTeamID} teamMode={teamMode} search={search} onSearch={setSearch} />
        {(frozen && ownRow || trimmed) && <p className="ib-ranking-note">
            {frozen && ownRow && t(teamMode ? "scoreboard.frozenOwnTeam" : "scoreboard.frozenOwn")}
            {frozen && ownRow && trimmed && " "}
            {trimmed && data && t("scoreboard.trimmed", {shown: data.Display.RowsLimit ?? 0, total: data.TotalTeams})}
        </p>}
    </div>;
}
