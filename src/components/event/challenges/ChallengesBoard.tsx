"use client";

import {useEffect, useMemo, useState, type ReactNode} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {getOwnChallenges, type OwnChallenge} from "@/api/participantChallenges";
import {getModeratorsBoard} from "@/api/moderatorsBoard";
import {getManageAccess} from "@/api/manage";
import {getCurrentUser} from "@/api/clientAuth";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {useGuestEvent} from "@/components/event/GuestShell";
import {usePrivateEvent} from "@/components/event/PrivateEventBootstrap";
import {EventCountdown} from "@/components/event/EventCountdown";
import {EventLoading} from "@/components/event/EventLoading";
import {EventBanner} from "@/components/event/EventBanner";
import {EventVpnProvider} from "@/components/event/vpn/EventVpn";
import {RailBoard, TilesBoard} from "./ChallengeBoards";
import {ChallengeModal, type BoardMode} from "./ChallengeModal";
import type {HintChargeMode} from "./hintModel";
import {t, tPlural} from "@/i18n/t";
import {richMessage} from "./richMessage";
import {
    boardViewKey, buildCategories, formatPoints, missingMembers, readBoardView, writeBoardView, type BoardView,
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

function Page({banners, sub, view, onView, countdown, children}: {banners?: ReactNode; sub?: ReactNode; view?: BoardView; onView?: (view: BoardView) => void; countdown?: ReactNode; children?: ReactNode}) {
    return <div className="event-challenges">
        {banners && <div className="ib-banner-stack event-challenges__banners">{banners}</div>}
        <header className="ib-page-header">
            <div className="ib-page-header__top">
                <div className="ib-page-header__heading"><h1 className="ib-page-header__title">{t("challenges.title")}</h1>{sub && <p className="ib-page-header__sub">{sub}</p>}</div>
                {view && onView && <div className="ib-page-header__actions"><div className="ib-seg" role="group" aria-label={t("challenges.view")}>
                    {([["tiles", "challenges.view.tiles"], ["rail", "challenges.view.rail"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => onView(value)}>{t(label)}</button>)}
                </div></div>}
            </div>
        </header>
        {countdown}
        {children}
    </div>;
}

function Board({eventID, mode, challenges, teamMode, finished, showDifficulty, showHints, hintChargeMode, userID, onRefresh, banners, countdown}: {
    eventID: string; mode: BoardMode; challenges: OwnChallenge[]; teamMode: boolean; finished: boolean;
    showDifficulty: boolean; showHints: boolean; hintChargeMode?: HintChargeMode; userID?: string; onRefresh: () => void; banners?: ReactNode; countdown?: ReactNode;
}) {
    const key = boardViewKey(userID);
    // The board renders only after client-side queries, so reading storage here never races hydration.
    const [choice, setChoice] = useState<{key: string; view: BoardView} | null>(null);
    const view = choice?.key === key ? choice.view : readBoardView(typeof window === "undefined" ? undefined : window.localStorage, key);
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [acceptedID, setAcceptedID] = useState<string | null>(null);
    useEffect(() => {
        if (!acceptedID) return;
        const timer = window.setTimeout(() => setAcceptedID(null), 1700);
        return () => window.clearTimeout(timer);
    }, [acceptedID]);
    const categories = useMemo(() => buildCategories(challenges), [challenges]);
    const selected = challenges.find(item => item.EventChallengeID === selectedID) ?? null;
    const solved = challenges.filter(item => item.SolvedAt);
    const points = solved.reduce((sum, item) => sum + item.Points, 0);
    const sub = mode === "moderators"
        ? tPlural("challenges.sub.moderators", challenges.length)
        : richMessage(t("challenges.sub.progress"), {solved: <span className="ib-num">{solved.length}</span>, total: <span className="ib-num">{challenges.length}</span>, points: <span className="ib-num">{formatPoints(points)}</span>});
    const changeView = (next: BoardView) => {
        setChoice({key, view: next});
        writeBoardView(window.localStorage, key, next);
    };
    const open = (challenge: OwnChallenge) => setSelectedID(challenge.EventChallengeID);
    return <Page banners={banners} countdown={countdown} sub={challenges.length ? sub : undefined} view={challenges.length ? view : undefined} onView={changeView}>
        {!categories.length ? <EmptyState message={t("challenges.emptyMessage")} />
            : view === "rail" ? <RailBoard categories={categories} acceptedID={acceptedID} onOpen={open} />
            : <TilesBoard categories={categories} acceptedID={acceptedID} onOpen={open} />}
        <ChallengeModal challenge={selected} eventID={eventID} mode={mode} teamMode={teamMode} finished={finished}
            showDifficulty={showDifficulty} showHints={showHints} hintChargeMode={hintChargeMode}
            onClose={() => setSelectedID(null)}
            onAccepted={challengeID => { setAcceptedID(challengeID); onRefresh(); }}
            onRejected={onRefresh}
            onHintUnlocked={onRefresh} />
    </Page>;
}

function ModeratorsBoard({event, finished}: {event: PublicEventInfo; finished: boolean}) {
    const access = useQuery({queryKey: ["event-management-access", event.EventID], queryFn: () => getManageAccess(event.EventID), retry: false, refetchOnWindowFocus: false});
    const user = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: false});
    const board = useQuery({queryKey: ["event-moderators-board", event.EventID], queryFn: () => getModeratorsBoard(event.EventID), enabled: !!access.data?.CanManage, retry: false, refetchInterval: 30000});
    if (access.isPending) return <EventLoading label={t("challenges.loading")} />;
    if (!access.data?.CanManage) return <Page><EmptyState message={t("challenges.participantsOnly")} action={<Link className="ib-btn ib-btn--primary" href="/join">{t("challenges.join")}</Link>} /></Page>;
    const banner = <EventBanner title={t("challenges.moderators.bannerTitle")} message={t("challenges.moderators.bannerMessage")} />;
    if (board.isPending) return <EventLoading label={t("challenges.loading")} />;
    if (board.isError) return <Page banners={banner}><EventLoadError message={t("challenges.moderators.unavailableTitle")} error={board.error} onRetry={() => void board.refetch()} /></Page>;
    return <EventVpnProvider eventID={event.EventID} eventTag={event.Tag} enabled={access.data.InfrastructureAllowed && board.data.some(item => item.Infrastructure)} moderators>
        <Board eventID={event.EventID} mode="moderators" challenges={board.data} teamMode finished={finished} showDifficulty showHints
            userID={user.data?.ID} onRefresh={() => void board.refetch()} banners={banner} />
    </EventVpnProvider>;
}

export function ChallengesBoard() {
    const participant = useParticipantContext();
    const guestEvent = useGuestEvent();
    const privateEvent = usePrivateEvent();
    const event = participant?.event ?? guestEvent ?? privateEvent;
    const {started, finished} = useClock(event);
    const info = participant?.participantInfo;
    const ownTeam = participant?.ownTeam ?? null;
    const teamMode = event?.Participation === 1;
    const admitted = ownTeam ? ownTeam.Admitted !== false : false;
    const challenges = useQuery({
        queryKey: ["event-own-challenges", event?.EventID],
        queryFn: () => getOwnChallenges(event!.EventID),
        enabled: !!participant && !!event && started && !!ownTeam && admitted && !!ownTeam.Formed,
        retry: false,
        refetchInterval: 30000,
    });
    const user = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, enabled: !!participant, retry: false, refetchOnWindowFocus: false});

    if (!event) return <EventLoading label={t("challenges.loading")} />;
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
    const countdown = <EventCountdown event={event} hint={t("countdown.start.challenges")} showFinished={false} />;
    if (!started) return <Page countdown={countdown}><EmptyState message={t("challenges.beforeStart")} /></Page>;
    if (!ownTeam.Formed) return <Page countdown={countdown}><EmptyState message={t("challenges.teamNotFormed")} /></Page>;
    if (challenges.isPending) return <EventLoading label={t("challenges.loading")} />;
    if (challenges.isError) return <Page banners={finishedBanner || undefined} countdown={countdown}><EventLoadError message={t("challenges.loadFailed.title")} error={challenges.error} onRetry={() => void challenges.refetch()} /></Page>;

    return <Board eventID={event.EventID} mode="participant" challenges={challenges.data} teamMode={teamMode} finished={finished}
        showDifficulty={info?.ShowDifficulty ?? true} showHints={!(info?.HintsDisabled ?? false)} hintChargeMode={info?.HintChargeMode} userID={user.data?.ID}
        onRefresh={() => void challenges.refetch()} banners={finishedBanner || undefined} countdown={countdown} />;
}
