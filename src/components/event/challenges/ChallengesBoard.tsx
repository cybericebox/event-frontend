"use client";

import {useEffect, useMemo, useState, type ReactNode} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getPreviewBoard, previewBoardKey} from "@/api/participantPreview";
import {getOwnBoard, type BoardStage, type OwnBoard, type OwnChallenge, type ChallengeSubmission} from "@/api/participantChallenges";
import {getModeratorsBoard, type ModeratorSubmission} from "@/api/moderatorsBoard";
import {applySubmission, applyModeratorSubmission, reconcileBoard, reconcileChallenges} from "./labLifecycleCache";
import {getManageAccess} from "@/api/manage";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {useParticipantPreview} from "@/components/event/ParticipantPreview";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {useGuestEvent} from "@/components/event/GuestShell";
import {usePrivateEvent} from "@/components/event/PrivateEventBootstrap";
import {EventCountdown} from "@/components/event/EventCountdown";
import {StageTimers} from "./StageTimers";
import {TeamConfirmPrompt} from "@/components/event/participation/TeamConfirmPrompt";
import {NotParticipant} from "@/components/event/participation/NotParticipant";
import {useParticipation} from "@/components/event/participation/participationRules";
import {BoardFilterBar} from "./BoardFilterBar";
import {EventLoading} from "@/components/event/EventLoading";
import {EventBanner} from "@/components/event/EventBanner";
import {EventVpnProvider} from "@/components/event/vpn/EventVpn";
import {TilesBoard} from "./ChallengeBoards";
import {ChallengeModal, type BoardMode} from "./ChallengeModal";
import type {HintChargeMode} from "./hintModel";
import {t, tPlural} from "@/i18n/t";
import {
    applyBoardFilters, awardedPoints, boardStatus, boardFilterSearch, buildGroups, DEFAULT_BOARD_FILTERS, formatClock, formatPoints, missingMembers,
    parseBoardFilters, type BoardFilters,
} from "./challengeBoardModel";

function useClock(event: PublicEventInfo | null) {
    const [now, setNow] = useState(() => Date.now());
    const started = !!event && Date.parse(event.StartTime) <= now;
    const finished = !!event?.FinishTime && Date.parse(event.FinishTime) <= now;
    // Tick until the finish so flag submission closes on time (U2).
    const ticking = !!event && (!started || (!!event.FinishTime && !finished));
    useEffect(() => {
        if (!ticking) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [ticking]);
    return {started, finished};
}

// The stage, status and group filters live in the URL (?stage=…&status=…&group=…), so a reload or a link keeps them.
function useBoardFilters(): [BoardFilters, (next: BoardFilters) => void] {
    const [filters, setFilters] = useState<BoardFilters>(() => parseBoardFilters(typeof window === "undefined" ? "" : window.location.search));
    const update = (next: BoardFilters) => {
        setFilters(next);
        if (typeof window === "undefined") return;
        const {pathname, search, hash} = window.location;
        window.history.replaceState(window.history.state, "", `${pathname}${boardFilterSearch(search, next)}${hash}`);
    };
    return [filters, update];
}

// A failed background poll with data on screen is a toast; the board and an open modal stay (only the first load shows LoadError).
function useRefreshFailedToast(failed: boolean, at: number) {
    useEffect(() => {
        if (failed) toast.error(t("challenges.refreshFailed"), {id: "event-challenges-refresh"});
    }, [failed, at]);
}

function Page({banners, sub, countdown, children}: {banners?: ReactNode; sub?: ReactNode; countdown?: ReactNode; children?: ReactNode}) {
    return <div className="event-challenges">
        {banners && <div className="ib-banner-stack event-challenges__banners">{banners}</div>}
        <header className="ib-page-header">
            <div className="ib-page-header__top">
                <div className="ib-page-header__heading"><h1 className="ib-page-header__title">{t("challenges.title")}</h1></div>{sub && <div className="ib-page-header__sub event-board-summary">{sub}</div>}

            </div>
        </header>
        {countdown}
        {children}
    </div>;
}

export function Board({eventID, mode, challenges, stages = [], nextOpensAt = null, teamMode, finished, showDifficulty, showHints, hintChargeMode, onRefresh, onSolved, banners, countdown}: {
    eventID: string; mode: BoardMode; challenges: OwnChallenge[]; stages?: BoardStage[]; nextOpensAt?: string | null; teamMode: boolean; finished: boolean;
    showDifficulty: boolean; showHints: boolean; hintChargeMode?: HintChargeMode; onRefresh: () => void; onSolved?: (challengeID: string, result: ChallengeSubmission | ModeratorSubmission) => void; banners?: ReactNode; countdown?: ReactNode;
}) {
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [acceptedID, setAcceptedID] = useState<string | null>(null);
    useEffect(() => {
        if (!acceptedID) return;
        const timer = window.setTimeout(() => setAcceptedID(null), 1700);
        return () => window.clearTimeout(timer);
    }, [acceptedID]);
    const [filters, setFilters] = useBoardFilters();
    const groups = useMemo(() => buildGroups(challenges), [challenges]);
    const stageGroups = useMemo(() => buildGroups(applyBoardFilters(challenges, {...filters, status: ""}, stages)), [challenges, filters, stages]);
    const visible = useMemo(() => applyBoardFilters(challenges, filters, stages), [challenges, filters, stages]);
    const shownGroups = stageGroups.map(group => ({...group, visible: visible.filter(task => (task.GroupID ?? "ungrouped") === group.key)}))
        .filter(group => group.visible.length > 0 || filters.status === "open" && group.challenges.every(task => boardStatus(task, stages) === "solved"));
    const selected = challenges.find(item => item.EventChallengeID === selectedID) ?? null;
    const toolbar = <BoardFilterBar filters={filters} stages={stages} groups={groups} hasClosed={challenges.some(item => boardStatus(item, stages) === "closed")} hasUnstaged={challenges.some(item => !item.StageID)} onChange={setFilters} />;
    const emptyMessage = nextOpensAt && (filters.status === "" || filters.status === "open") && !filters.stage
        ? t("challenges.stage.emptyBreak", {time: formatClock(nextOpensAt)})
        : t("challenges.filter.empty");
    const solved = challenges.filter(item => item.SolvedAt || item.Practice);
    const points = solved.reduce((sum, item) => sum + (item.Practice ? 0 : awardedPoints(item)), 0);
    const preview = useParticipantPreview(eventID);
    const sub = mode === "moderators" && !preview.active
        ? tPlural("challenges.sub.moderators", challenges.length)
        : <dl className="event-board-stats"><div><dt>{t("challenges.stats.points")}</dt><dd>{formatPoints(points)}</dd></div><div><dt>{t("challenges.stats.solved")}</dt><dd>{solved.length}<small> / {challenges.length}</small></dd></div></dl>;
    const open = (challenge: OwnChallenge) => setSelectedID(challenge.EventChallengeID);
    const board = {groups: shownGroups, showDifficulty, acceptedID, onOpen: open, toolbar, emptyMessage, onResetFilters: () => setFilters(DEFAULT_BOARD_FILTERS)};
    return <Page banners={banners} countdown={countdown} sub={challenges.length ? sub : undefined}>
        {!challenges.length ? <EmptyState message={t("challenges.emptyMessage")} /> : <TilesBoard {...board} />}
        <ChallengeModal challenge={selected} stage={stages.find(item => item.ID === selected?.StageID) ?? null} eventID={eventID} mode={mode} teamMode={teamMode} finished={finished}
            showDifficulty={showDifficulty} showHints={showHints} hintChargeMode={hintChargeMode}
            onClose={() => setSelectedID(null)}
            onAccepted={(challengeID, result) => { setAcceptedID(challengeID); onSolved?.(challengeID, result); onRefresh(); }}
            onRejected={onRefresh}
            onHintUnlocked={onRefresh} />
    </Page>;
}

function PreviewBoard({event}: {event: PublicEventInfo}) {
    const preview = useParticipantPreview(event.EventID);
    const queryClient = useQueryClient();
    const board = useQuery({queryKey: previewBoardKey(event.EventID), queryFn: () => getPreviewBoard(event.EventID), retry: false, refetchInterval: 10000});
    useRefreshFailedToast(board.isError && !!board.data, board.errorUpdatedAt);
    if (!board.data) return <Page>{board.isPending ? <EventLoading label={t("challenges.loading")} /> : <EventLoadError message={t("challenges.loadFailed.title")} error={board.error} onRetry={() => void board.refetch()} />}</Page>;
    // A dynamic task has no addresses until its lab runs: while «Показати завдання» launches the labs its card shows the loader
    // and does not open. With no run once the launch is over (failed, ended) it opens, so the task's own start button can retry.
    const launching = preview.infraBusy === "starting";
    const challenges = board.data.Challenges.map(task => launching && task.PreviewDynamic && !task.PreviewRunID && task.PreviewCanStart === true
        ? {...task, Locked: true, LockedNote: t("challenges.preview.startingInfra"), LockedBusy: true}
        : task);
    return <EventVpnProvider eventID={event.EventID} eventTag={event.Tag} enabled={board.data.Challenges.some(item => item.Infrastructure)}>
        <Board eventID={event.EventID} mode="preview" challenges={challenges} teamMode={event.Participation === 1} finished={false}
            showDifficulty={preview.config?.ShowDifficulty ?? true} showHints={preview.config?.HintsDisabled === false} hintChargeMode={preview.config?.HintChargeMode}
            banners={<EventBanner title={t("challenges.preview.note")} />} onRefresh={() => void board.refetch()}
            onSolved={(id, result) => {
                if (!result.Correct) return;
                const at = new Date().toISOString();
                queryClient.setQueryData<OwnBoard>(previewBoardKey(event.EventID), current => current && ({...current, Challenges: current.Challenges.map(task => task.EventChallengeID === id ? {...task, SolvedAt: at, AwardedPoints: task.Points, SolveCount: 1} : task)}));
            }} />
    </EventVpnProvider>;
}

function ModeratorsBoard({event, finished}: {event: PublicEventInfo; finished: boolean}) {
    const preview = useParticipantPreview(event.EventID);
    const queryClient = useQueryClient();
    const access = useQuery({queryKey: ["event-management-access", event.EventID], queryFn: () => getManageAccess(event.EventID), retry: false, refetchOnWindowFocus: false});
    const board = useQuery({queryKey: ["event-moderators-board", event.EventID], queryFn: async ({signal}) => {
        const response = await getModeratorsBoard(event.EventID);
        signal.throwIfAborted();
        return reconcileChallenges(queryClient, "moderators", event.EventID, response);
    }, select: data => preview.active ? data.filter(item => item.BoardPublished !== false) : data, enabled: !!access.data?.CanManage, retry: false, refetchInterval: 30000});
    useRefreshFailedToast(board.isError && !!board.data, board.errorUpdatedAt);
    if (access.isPending) return <EventLoading label={t("challenges.loading")} />;
    // Staff without the manage right cannot register for their own event either: no «Приєднатися» for them.
    if (access.data && !access.data.CanManage) return <Page><EmptyState message={t("challenges.viewerOnly")} /></Page>;
    if (!access.data?.CanManage) return <Page><NotParticipant eventID={event.EventID} message={t("challenges.participantsOnly")} action={t("challenges.join")} /></Page>;
    const banner = preview.active ? undefined : <EventBanner title={t("challenges.moderators.bannerTitle")} message={t("challenges.moderators.bannerMessage")} />;
    if (!board.data) {
        return <Page banners={banner}>{board.isPending
            ? <EventLoading label={t("challenges.loading")} />
            : <EventLoadError message={t("challenges.moderators.unavailableTitle")} error={board.error} onRetry={() => void board.refetch()} />}</Page>;
    }
    return <EventVpnProvider eventID={event.EventID} eventTag={event.Tag} enabled={access.data.InfrastructureAllowed && board.data.some(item => item.Infrastructure)} moderators>
        <Board eventID={event.EventID} mode="moderators" challenges={board.data} teamMode={event.Participation === 1} finished={finished} showDifficulty={preview.config?.ShowDifficulty ?? true} showHints={!(preview.config?.HintsDisabled ?? false)} hintChargeMode={preview.config?.HintChargeMode}
            onRefresh={() => void board.refetch()} banners={banner}
            onSolved={(id, result) => applyModeratorSubmission(queryClient, event.EventID, id, result, new Date().toISOString())} />
    </EventVpnProvider>;
}

export function ChallengesBoard() {
    const queryClient = useQueryClient();
    const participant = useParticipantContext();
    const guestEvent = useGuestEvent();
    const privateEvent = usePrivateEvent();
    const event = participant?.event ?? guestEvent ?? privateEvent;
    const preview = useParticipantPreview(event?.EventID);
    const {started, finished} = useClock(event);
    const info = participant?.participantInfo;
    const ownTeam = participant?.ownTeam ?? null;
    const teamMode = event?.Participation === 1;
    const admitted = ownTeam ? ownTeam.Admitted !== false : false;
    const teamParticipation = useParticipation(event?.EventID, !preview.active && !!participant && !!ownTeam && !ownTeam.Formed);
    const needsConfirmation = teamParticipation.data?.TeamNeedsConfirmation === true;
    const challenges = useQuery({
        queryKey: ["event-own-challenges", event?.EventID],
        queryFn: async ({signal}) => {
            const response = await getOwnBoard(event!.EventID);
            signal.throwIfAborted();
            return reconcileBoard(queryClient, "participant", event!.EventID, response);
        },
        enabled: !preview.active && !!participant && !!event && started && !!ownTeam && admitted && !!ownTeam.Formed,
        retry: false,
        refetchInterval: 30000,
    });
    // The stage clocks count against the server's time; the board is refetched at the next stage boundary, so it never polls for it.
    const board: OwnBoard | undefined = challenges.data;
    const offset = board ? Date.parse(board.ServerNow) - challenges.dataUpdatedAt : 0;
    const nextChangeAt = board?.NextChangeAt ?? null;
    const refetchBoard = challenges.refetch;
    useEffect(() => {
        if (!nextChangeAt) return;
        const delay = Date.parse(nextChangeAt) - (Date.now() + offset) + 500;
        if (!Number.isFinite(delay) || delay > 2_000_000_000) return;
        const timer = setTimeout(() => void refetchBoard(), Math.max(delay, 500));
        return () => clearTimeout(timer);
    }, [nextChangeAt, offset, refetchBoard]);

    useRefreshFailedToast(challenges.isError && !!challenges.data, challenges.errorUpdatedAt);
    if (!event) return <EventLoading label={t("challenges.loading")} />;
    if (preview.active) {
        // The test tasks are staff's own: unless «Показати завдання» is off they show whatever the simulated registration, team and event phase say.
        if (preview.state!.tasks) return <PreviewBoard event={event} />;
        if (preview.state!.status !== 2) return <Page><EmptyState message={t("challenges.participantsOnly")} action={<Link className="ib-btn ib-btn--primary" href="/join">{t("challenges.join")}</Link>} /></Page>;
        if (event.Participation === 1 && !preview.state!.team) return <Page banners={<EventBanner title={t("challenges.noTeam.title")} message={t("challenges.noTeam.message")} action={<Link className="ib-btn ib-btn--sm ib-btn--primary" href="/participation?tab=team">{t("challenges.noTeam.action")}</Link>} />} />;
        if (event.Participation === 1 && !preview.state!.team?.Formed) return <Page><EmptyState message={t("challenges.preparing")} action={<Link className="ib-btn ib-btn--primary" href="/participation?tab=team">{t("challenges.myParticipation")}</Link>} /></Page>;
        return <PreviewBoard event={event} />;
    }
    if (!participant) return <ModeratorsBoard event={event} finished={finished} />;

    const finishedBanner = finished && <EventBanner title={t("challenges.finished.title")} message={t("challenges.finished.message")} />;
    if (teamMode && !ownTeam) {
        return <Page banners={<EventBanner title={t("challenges.noTeam.title")} message={t("challenges.noTeam.message")} action={<Link className="ib-btn ib-btn--sm ib-btn--primary" href="/participation">{t("challenges.noTeam.action")}</Link>} />} />;
    }
    if (!ownTeam) return <Page><EmptyState message={t("challenges.preparing")} /></Page>;
    if (!admitted) {
        const missing = missingMembers(ownTeam.MemberCount, ownTeam.MinTeamSize ?? info?.MinTeamSize);
        const title = missing > 0 ? tPlural("team.notAdmitted.missing", missing) : t("team.notAdmitted.title");
        return <Page banners={<EventBanner tone="warning" title={title} message={t("challenges.notAdmitted.message")} action={<Link className="ib-btn ib-btn--sm" href="/participation">{t("challenges.myParticipation")}</Link>} />} />;
    }
    const countdown = <div className="event-challenges__timers">
        <EventCountdown event={event} hint={t("countdown.start.challenges")} showFinished={false} />
        {board && <StageTimers board={board} offset={offset} onZero={() => void refetchBoard()} />}
    </div>;
    if (!started) return <Page countdown={countdown}><EmptyState message={t("challenges.beforeStart")} /></Page>;
    // A late-join team waits for its captain: the captain is asked to confirm, the members told to wait. Where
    // the start forms every team nothing about confirmation is shown.
    // Until the participation rules are known, the crest loader holds the block: no "preparing" state that swaps.
    if (!ownTeam.Formed && teamParticipation.isPending) return <Page countdown={countdown}><EventLoading label={t("challenges.loading")} /></Page>;
    if (!ownTeam.Formed) return needsConfirmation
        ? <Page banners={<TeamConfirmPrompt eventID={event.EventID} />} countdown={countdown} />
        : <Page countdown={countdown}><EmptyState message={t("challenges.preparing")} /></Page>;
    if (!challenges.data) {
        return <Page banners={finishedBanner || undefined} countdown={countdown}>{challenges.isPending
            ? <EventLoading label={t("challenges.loading")} />
            : <EventLoadError message={t("challenges.loadFailed.title")} error={challenges.error} onRetry={() => void challenges.refetch()} />}</Page>;
    }

    return <Board eventID={event.EventID} mode="participant" challenges={challenges.data.Challenges} stages={challenges.data.Stages} nextOpensAt={challenges.data.NextOpensAt} teamMode={teamMode} finished={finished}
        showDifficulty={info?.ShowDifficulty ?? true} showHints={!(info?.HintsDisabled ?? false)} hintChargeMode={info?.HintChargeMode}
        onRefresh={() => void challenges.refetch()} banners={finishedBanner || undefined} countdown={countdown}
        onSolved={(id, result) => applySubmission(queryClient, event.EventID, id, {...result, Practice: "Practice" in result && result.Practice}, new Date().toISOString())} />;
}
