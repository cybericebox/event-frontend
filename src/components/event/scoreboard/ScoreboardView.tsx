"use client";

import {useEffect, useRef, useState} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getManageResults, getResultsChanges, ResultsUnavailableError} from "@/api/manageResults";
import {ManageApiError} from "@/api/manage";
import {resultsAvailability} from "@/types/resultsAvailability";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantPreview, previewResultsAvailability} from "@/components/event/ParticipantPreview";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {useStaffAccess} from "@/components/event/useStaffAccess";
import {EventLoading} from "@/components/event/EventLoading";
import {EventCountdown} from "@/components/event/EventCountdown";
import {nextFreezeBoundary} from "@/utils/resultsFreeze";
import {t} from "@/i18n/t";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {applyResultsPoll, chartTeamIDs, RESULTS_POLL_SECONDS, resultsPollDelay, scoreboardAccess, searchScoreboard, unitCount, type PollCursor} from "./scoreboardModel";
import {ScoreChart} from "./ScoreChart";
import {ScoreTable, type ScoreTableState} from "./ScoreTable";
// LiveStatus is styled with the manage table sheet.
import "@/components/event/manage/manageTable.css";
import "./scoreboard.css";

import {getPreviewBoard} from "@/api/participantPreview";
import {previewProgress, previewResults} from "../participation/previewProgress";

const deniedMessages = {hidden: "scoreboard.hidden", participants_only: "scoreboard.participantsOnly"} as const;

function isAccessDenied(error: unknown): boolean {
    return error instanceof ManageApiError && [401, 403, 404].includes(error.status);
}

// The participant and guest «Результати»: a chart of the leaders (plus the
// viewer's own team) above a searchable ranking. The page exists in every
// phase for whoever may read the results; before the start the table block
// says when the ranking appears.
export function ScoreboardView() {
    const participant = useParticipantContext();
    const guestEvent = useGuestEvent();
    const event = participant?.event ?? guestEvent;
    const preview = useParticipantPreview(event?.EventID);
    const access = useStaffAccess(event?.EventID);
    const base = participant ? resultsAvailability(participant.participantInfo) : event ? resultsAvailability(event) : "hidden";
    const [now, setNow] = useState(() => Date.now());
    const [search, setSearch] = useState("");
    const [revokedSnapshotFor, setRevokedSnapshotFor] = useState<string | null>(null);
    const started = preview.active || !!event && Date.parse(event.StartTime) <= now;
    const view = scoreboardAccess(preview.active ? previewResultsAvailability(base, preview.state!.status, preview.config) : base, !preview.active && access.staff);
    const readable = view.fetch;
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), started ? 30000 : 1000);
        return () => clearInterval(id);
    }, [started]);
    const queryClient = useQueryClient();
    const queryKey = [preview.active ? "event-preview-results" : "event-public-results", event?.EventID];
    const results = useQuery({
        queryKey,
        queryFn: async () => {
            if (preview.active) return previewResults(previewProgress((await getPreviewBoard(event!.EventID)).Challenges, {
                userID: preview.state!.userID, name: t("participantPreview.you"), teamID: preview.state?.team?.ID, teamName: preview.state?.team?.Name,
            }));
            try {
                const snapshot = await getManageResults(event!.EventID);
                setRevokedSnapshotFor(current => current === event!.EventID ? null : current);
                return snapshot;
            } catch (error) {
                if (isAccessDenied(error)) setRevokedSnapshotFor(event!.EventID);
                throw error;
            }
        },
        enabled: !!event && readable && (preview.active || !access.pending),
        refetchInterval: preview.active ? 10000 : false,
        retry: false,
        refetchOnWindowFocus: false,
    });
    // «Автооновлення», no stream per viewer: every 30 s ±20 % the page asks
    // for the result changes after its snapshot (an unchanged answer is a
    // 304) and reloads the snapshot only when something visible changed. It
    // backs off after errors, pauses in a hidden tab and checks at once when
    // the tab is shown again.
    const cursor = useRef<PollCursor | null>(null);
    const snapshotRevision = results.data?.Revision;
    const snapshotAt = results.dataUpdatedAt;
    useEffect(() => {
        if (snapshotRevision !== undefined) cursor.current = {since: snapshotRevision, freezeKey: cursor.current?.freezeKey ?? null};
    }, [snapshotRevision, snapshotAt]);
    const polls = useQuery({
        queryKey: ["event-public-results-changes", event?.EventID],
        queryFn: async () => {
            try {
                const current = cursor.current!;
                const step = applyResultsPoll(current, await getResultsChanges(event!.EventID, current.since, current.freezeKey));
                cursor.current = step.cursor;
                if (step.reload) await queryClient.invalidateQueries({queryKey});
                return step.cursor.since;
            } catch (error) {
                // Revoke cached rows immediately, then ask the snapshot for the current access reason.
                if (isAccessDenied(error)) await queryClient.resetQueries({queryKey, exact: true});
                throw error;
            }
        },
        enabled: !preview.active && !!event && readable && snapshotRevision !== undefined,
        initialData: () => snapshotRevision, initialDataUpdatedAt: () => snapshotAt,
        staleTime: RESULTS_POLL_SECONDS * 1000 * 0.8,
        retry: false,
        refetchInterval: query => resultsPollDelay(query.state.fetchFailureCount),
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: "always",
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

    if (!event || !preview.active && access.pending) return <EventLoading event={event} label={t("scoreboard.loadingRanking")} />;
    const teamMode = event.Participation === 1;
    const ownTeamID = preview.active ? preview.state?.team?.ID ?? preview.state?.userID : participant?.ownTeam?.ID;
    // A reply that closes the board (the setting changed meanwhile) wins. «Not started» is no denial: the countdown
    // above already says when the ranking appears, so the page shows nothing else.
    const notStarted = results.error instanceof ResultsUnavailableError && results.error.reason === "not_started";
    const denied = notStarted ? null : results.error instanceof ResultsUnavailableError ? deniedMessages[results.error.reason as keyof typeof deniedMessages] ?? "scoreboard.hidden" : view.message;
    const accessDenied = isAccessDenied(results.error) || !preview.active && revokedSnapshotFor === event.EventID;
    const data = !denied && !notStarted && !accessDenied ? results.data : undefined;
    const rows = data ? searchScoreboard(data, search) : [];
    let state: ScoreTableState;
    if (denied) state = {kind: "closed", message: t(denied)};
    else if (results.isError && !data) state = {kind: "custom", content: <EventLoadError message={t("scoreboard.loadFailed")} error={results.error} onRetry={() => void results.refetch()} />};
    else if (!data) state = {kind: "loading"};
    else if (data.Scoreboard.length === 0) state = {kind: "empty", message: t(teamMode ? "scoreboard.noTeams" : "scoreboard.noParticipants")};
    else if (rows.length === 0) state = {kind: "empty", message: t("scoreboard.emptySearch")};
    else state = {kind: "rows", rows};

    const ownRow = !!data && !!ownTeamID && data.Scoreboard.some(entry => entry.TeamID === ownTeamID);
    const frozen = !!data?.Freeze.Applied;
    const previewStartAt = preview.state?.startedAt ? Date.parse(preview.state.startedAt) : NaN;
    // Older saved previews did not record their start; retain their earliest known point until a new test starts.
    const startAt = preview.active ? Number.isFinite(previewStartAt) ? previewStartAt : Math.min(Date.parse(event.StartTime), data?.Timeline[0] ? Date.parse(data.Timeline[0].SolvedAt) : now) : Date.parse(event.StartTime);
    const finishAt = event.FinishTime ? Date.parse(event.FinishTime) : null;
    // Before the start the axes span the planned event (or two hours).
    const chartNow = frozen && data?.Freeze.FrozenAt ? Math.min(now, Date.parse(data.Freeze.FrozenAt)) : now;
    const chartEnd = !started ? finishAt ?? startAt + 2 * 3_600_000 : Math.max(startAt + 60000, preview.active ? now : Math.min(finishAt ?? Number.POSITIVE_INFINITY, chartNow));
    const chartIDs = data && started ? chartTeamIDs(data, ownTeamID) : [];
    const chartNote = !data ? undefined : !started ? t("scoreboard.chartAfterStart") : data.Scoreboard.length === 0 ? t(teamMode ? "scoreboard.noTeams" : "scoreboard.noParticipants") : undefined;
    const sub = data ? unitCount(data.TotalTeams, teamMode) : null;
    const pollHint = t("scoreboard.pollHint", {seconds: RESULTS_POLL_SECONDS});
    const trimmed = !!data && data.Display.RowsLimit !== null && data.TotalTeams > data.Display.RowsLimit;

    return <div className="event-results">
        <div className="event-results__head">
            <header className="ib-page-header">
                <div className="ib-page-header__top"><div className="ib-page-header__heading"><h1 className="ib-page-header__title">{t("scoreboard.title")}</h1>{sub && <p className="ib-page-header__sub">{sub}</p>}</div></div>
            </header>
            {readable && !denied && !notStarted && !accessDenied && <div className="event-results__actions"><LiveStatus freshness={{kind: "polling", seconds: RESULTS_POLL_SECONDS, failing: polls.isError}} updatedAt={Math.max(results.dataUpdatedAt, polls.dataUpdatedAt)} hint={pollHint} /></div>}
        </div>
        <EventCountdown event={event} hint={t("countdown.start.results")} />
        {data && data.Display.ChartEnabled && <div className="event-results__chart" data-testid="score-chart">
            <ScoreChart snapshot={data} teamIDs={chartIDs} ownTeamID={ownTeamID} startTime={new Date(startAt)} finishTime={new Date(chartEnd)} note={chartNote} title={chartIDs.length === 0 ? t("scoreboard.chartTitlePlain") : t(ownRow ? (teamMode ? "scoreboard.chartTitleOwnTeam" : "scoreboard.chartTitleOwn") : "scoreboard.chartTitle", {top: Math.min(data.Display.ChartTeams, data.Scoreboard.length)})} />
        </div>}
        {notStarted ? !event.ShowStartCountdown && <ScoreTable event={event} state={{kind: "closed", message: t("countdown.start.results")}} teamMode={teamMode} />
            : <ScoreTable event={event} state={state} ownTeamID={ownTeamID} teamMode={teamMode} search={search} onSearch={setSearch} />}
        {trimmed && data && <p className="ib-ranking-note">{t("scoreboard.trimmed", {shown: data.Display.RowsLimit ?? 0, total: data.TotalTeams})}</p>}
    </div>;
}
