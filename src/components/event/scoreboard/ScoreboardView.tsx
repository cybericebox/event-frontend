"use client";

import {useEffect, useState} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getManageResults, resultsLiveURL, ResultsUnavailableError, type ManageResultsSnapshot} from "@/api/manageResults";
import {resultsAvailability} from "@/types/resultsAvailability";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {useStaffAccess} from "@/components/event/useStaffAccess";
import {EventLoading} from "@/components/event/EventLoading";
import {EventBanner} from "@/components/event/EventBanner";
import {useEventStream} from "@/utils/eventStream";
import {jitter} from "@/utils/jitter";
import {frozenBannerTitle, frozenSinceLabel, nextFreezeBoundary} from "@/utils/resultsFreeze";
import {t} from "@/i18n/t";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {chartTeamIDs, scoreboardAccess, searchScoreboard, unitCount} from "./scoreboardModel";
import {ScoreChart} from "./ScoreChart";
import {ScoreTable, type ScoreTableState} from "./ScoreTable";
// LiveStatus is styled with the manage table sheet.
import "@/components/event/manage/manageTable.css";
import "./scoreboard.css";

const deniedMessages = {hidden: "scoreboard.hidden", participants_only: "scoreboard.participantsOnly"} as const;
const POLL_SECONDS = 30;
// The stream's server check period for this page (the staff live screen sets
// its own). 10 s ±20 %, drawn once per page, so viewers do not tick in step.
const STREAM_SECONDS = 10;

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
    const [now, setNow] = useState(() => Date.now());
    const [search, setSearch] = useState("");
    const started = !!event && Date.parse(event.StartTime) <= now;
    const view = scoreboardAccess(base, access.staff);
    const readable = view.fetch;
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), started ? 30000 : 1000);
        return () => clearInterval(id);
    }, [started]);
    const queryClient = useQueryClient();
    const queryKey = ["event-public-results", event?.EventID];
    const revision = queryClient.getQueryData<ManageResultsSnapshot>(queryKey)?.Revision;
    const [pacing] = useState(() => ({streamSeconds: Math.round(jitter(STREAM_SECONDS * 1000) / 1000), reloadMs: jitter(2000)}));
    // Realtime: every change reloads the snapshot (the server applies the
    // freeze), spread over the viewers; 30 s ±20 % polling only when the
    // stream keeps failing. A hidden tab neither streams nor polls.
    const stream = useEventStream({
        url: () => {
            const url = event && revision !== undefined ? resultsLiveURL(event.EventID, revision) : null;
            return url && `${url}&pollInterval=${pacing.streamSeconds}`;
        },
        events: ["result-change"], resetEvents: ["snapshot-required"],
        onChange: () => void queryClient.invalidateQueries({queryKey}),
        enabled: !!event && readable && revision !== undefined,
        debounceMs: pacing.reloadMs, pauseWhenHidden: true,
    });
    const results = useQuery({
        queryKey,
        queryFn: () => getManageResults(event!.EventID),
        enabled: !!event && readable && !access.pending,
        retry: false,
        refetchInterval: stream === "fallback" ? () => jitter(POLL_SECONDS * 1000) : false,
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
    // A reply that closes the board (the setting changed meanwhile) wins.
    const denied = results.error instanceof ResultsUnavailableError ? deniedMessages[results.error.reason as keyof typeof deniedMessages] ?? "scoreboard.hidden" : view.message;
    const data = !denied ? results.data : undefined;
    const rows = data ? searchScoreboard(data, search) : [];
    let state: ScoreTableState;
    if (denied) state = {kind: "empty", message: t(denied)};
    else if (results.isError) state = {kind: "custom", content: <EventLoadError message={t("scoreboard.loadFailed")} onRetry={() => void results.refetch()} />};
    else if (!data) state = {kind: "loading"};
    else if (data.Scoreboard.length === 0) state = {kind: "empty", message: t(teamMode ? "scoreboard.noTeams" : "scoreboard.noParticipants")};
    else if (rows.length === 0) state = {kind: "empty", message: t("scoreboard.emptySearch")};
    else state = {kind: "rows", rows};

    const ownRow = !!data && !!ownTeamID && data.Scoreboard.some(entry => entry.TeamID === ownTeamID);
    const frozen = !!data?.Freeze.Applied;
    const finished = !!event.FinishTime && Date.parse(event.FinishTime) <= now;
    const startAt = Date.parse(event.StartTime);
    const finishAt = event.FinishTime ? Date.parse(event.FinishTime) : null;
    // Before the start the axes span the planned event (or two hours).
    const chartEnd = !started ? finishAt ?? startAt + 2 * 3_600_000 : Math.max(startAt + 60000, Math.min(finishAt ?? Number.POSITIVE_INFINITY, now));
    const chartIDs = data && started ? chartTeamIDs(data, ownTeamID) : [];
    const chartNote = !data ? undefined : !started ? t("scoreboard.chartAfterStart") : data.Scoreboard.length === 0 ? t(teamMode ? "scoreboard.noTeams" : "scoreboard.noParticipants") : undefined;
    const status = frozen ? t("scoreboard.status.frozen") : !started ? t("scoreboard.status.beforeStart") : finished ? t("scoreboard.status.final") : t("scoreboard.status.current");
    const sub = data ? t("scoreboard.sub", {units: unitCount(data.TotalTeams, teamMode), status}) : null;
    const trimmed = !!data && data.Display.RowsLimit !== null && data.TotalTeams > data.Display.RowsLimit;

    return <div className="event-results">
        {frozen && data && <div className="ib-banner-stack event-results__banners"><EventBanner tone="warning" title={frozenBannerTitle(data.Freeze)} meta={frozenSinceLabel(data.Freeze)} message={t("scoreboard.frozenMessage")} /></div>}
        <div className="event-results__head">
            <header className="ib-page-header">
                <div className="ib-page-header__top"><div className="ib-page-header__heading"><h1 className="ib-page-header__title">{t("scoreboard.title")}</h1>{sub && <p className="ib-page-header__sub">{sub}</p>}</div></div>
            </header>
            {readable && <div className="event-results__actions"><LiveStatus freshness={{kind: "stream", mode: stream, pollSeconds: POLL_SECONDS}} updatedAt={results.dataUpdatedAt} /></div>}
        </div>
        {data && data.Display.ChartEnabled && <div className="event-results__chart rounded-lg border border-border bg-card p-4" data-testid="score-chart">
            <p className="mb-2 text-sm font-semibold text-foreground">{chartIDs.length === 0 ? t("scoreboard.chartTitlePlain") : t(ownRow ? (teamMode ? "scoreboard.chartTitleOwnTeam" : "scoreboard.chartTitleOwn") : "scoreboard.chartTitle", {top: Math.min(data.Display.ChartTeams, data.Scoreboard.length)})}</p>
            <ScoreChart snapshot={data} teamIDs={chartIDs} ownTeamID={ownTeamID} startTime={new Date(startAt)} finishTime={new Date(chartEnd)} note={chartNote} />
        </div>}
        <ScoreTable event={event} state={state} ownTeamID={ownTeamID} teamMode={teamMode} search={search} onSearch={setSearch} />
        {(frozen && ownRow || trimmed) && <p className="ib-ranking-note">
            {frozen && ownRow && t(teamMode ? "scoreboard.frozenOwnTeam" : "scoreboard.frozenOwn")}
            {frozen && ownRow && trimmed && " "}
            {trimmed && data && t("scoreboard.trimmed", {shown: data.Display.RowsLimit ?? 0, total: data.TotalTeams})}
        </p>}
    </div>;
}
