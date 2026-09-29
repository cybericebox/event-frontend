"use client";

import {useEffect, useMemo, useState, type ReactNode} from "react";
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
import {CountdownTimer} from "@/components/Countdown";
import {EventLoading} from "@/components/event/EventLoading";
import {EventBanner} from "@/components/event/EventBanner";
import {EventVpnProvider} from "@/components/event/vpn/EventVpn";
import {RailBoard, TilesBoard} from "./ChallengeBoards";
import {ChallengeModal, type BoardMode} from "./ChallengeModal";
import {
    boardViewKey, buildCategories, formatPoints, missingMembers, pluralUk, readBoardView, writeBoardView, type BoardView,
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

function Page({banners, sub, view, onView, children}: {banners?: ReactNode; sub?: ReactNode; view?: BoardView; onView?: (view: BoardView) => void; children?: ReactNode}) {
    return <div className="event-challenges">
        {banners && <div className="ib-banner-stack event-challenges__banners">{banners}</div>}
        <header className="ib-page-header">
            <div className="ib-page-header__top">
                <div className="ib-page-header__heading"><h1 className="ib-page-header__title">Завдання</h1>{sub && <p className="ib-page-header__sub">{sub}</p>}</div>
                {view && onView && <div className="ib-page-header__actions"><div className="ib-seg" role="group" aria-label="Вигляд">
                    {([["tiles", "Плитки"], ["rail", "Рейка"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => onView(value)}>{label}</button>)}
                </div></div>}
            </div>
        </header>
        {children}
    </div>;
}

function Empty({title, children}: {title: string; children?: ReactNode}) {
    return <div className="ib-board__empty"><b>{title}</b>{children}</div>;
}

function Board({eventID, mode, challenges, teamMode, finished, showDifficulty, showHints, userID, onRefresh, banners}: {
    eventID: string; mode: BoardMode; challenges: OwnChallenge[]; teamMode: boolean; finished: boolean;
    showDifficulty: boolean; showHints: boolean; userID?: string; onRefresh: () => void; banners?: ReactNode;
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
        ? <>{challenges.length} {pluralUk(challenges.length, "завдання", "завдання", "завдань")} команди модераторів</>
        : <>Розвʼязано <span className="ib-num">{solved.length}</span> з <span className="ib-num">{challenges.length}</span> · <span className="ib-num">{formatPoints(points)}</span> балів</>;
    const changeView = (next: BoardView) => {
        setChoice({key, view: next});
        writeBoardView(window.localStorage, key, next);
    };
    const open = (challenge: OwnChallenge) => setSelectedID(challenge.EventChallengeID);
    return <Page banners={banners} sub={challenges.length ? sub : undefined} view={challenges.length ? view : undefined} onView={changeView}>
        {!categories.length ? <Empty title="Завдань поки немає">Вони з’являться тут, щойно організатори їх опублікують.</Empty>
            : view === "rail" ? <RailBoard categories={categories} acceptedID={acceptedID} onOpen={open} />
            : <TilesBoard categories={categories} acceptedID={acceptedID} onOpen={open} />}
        <ChallengeModal challenge={selected} eventID={eventID} mode={mode} teamMode={teamMode} finished={finished}
            showDifficulty={showDifficulty} showHints={showHints}
            onClose={() => setSelectedID(null)}
            onAccepted={challengeID => { setAcceptedID(challengeID); onRefresh(); }} />
    </Page>;
}

function ModeratorsBoard({event, finished}: {event: PublicEventInfo; finished: boolean}) {
    const access = useQuery({queryKey: ["event-management-access", event.EventID], queryFn: () => getManageAccess(event.EventID), retry: false, refetchOnWindowFocus: false});
    const user = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: false});
    const board = useQuery({queryKey: ["event-moderators-board", event.EventID], queryFn: () => getModeratorsBoard(event.EventID), enabled: !!access.data?.CanManage, retry: false, refetchInterval: 30000});
    if (access.isPending) return <EventLoading label="Завантажуємо завдання…" />;
    if (!access.data?.CanManage) return <Page><Empty title="Завдання доступні учасникам події"><br /><Link className="ib-btn ib-btn--primary" href="/join">Приєднатися</Link></Empty></Page>;
    const banner = <EventBanner title="Перевірка завдань від імені команди модераторів" message="Прапори, файли й адреси — як у команди; результати не змінюються." />;
    if (board.isPending) return <EventLoading label="Завантажуємо завдання…" />;
    if (board.isError) return <Page banners={banner}><Empty title="Дошка модераторів недоступна">Команда модераторів з’явиться, коли почнеться підготовка стендів. <button type="button" className="ib-btn ib-btn--sm" onClick={() => void board.refetch()}>Повторити</button></Empty></Page>;
    return <EventVpnProvider eventID={event.EventID} enabled={access.data.InfrastructureAllowed && board.data.some(item => item.Infrastructure)} moderators>
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
        enabled: !!participant && !!event && started && !!ownTeam && admitted,
        retry: false,
        refetchInterval: 30000,
    });
    const user = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, enabled: !!participant, retry: false, refetchOnWindowFocus: false});

    if (!event) return <EventLoading label="Завантажуємо завдання…" />;
    if (!participant) return <ModeratorsBoard event={event} finished={finished} />;

    const finishedBanner = finished && <EventBanner title="Подію завершено" message="Відповіді більше не приймаються. Завдання лишаються для перегляду." />;
    if (teamMode && !ownTeam) {
        return <Page banners={<EventBanner title="Команду не зареєстровано" message="Завдання відкриються, щойно ви створите команду або приєднаєтеся до неї." action={<Link className="ib-btn ib-btn--sm ib-btn--primary" href="/participation">Зареєструвати</Link>} />} />;
    }
    if (!ownTeam) return <Page><Empty title="Готуємо вашу участь">Завдання з’являться тут після старту.</Empty></Page>;
    if (!admitted) {
        const missing = missingMembers(ownTeam.MemberCount, ownTeam.MinTeamSize ?? info?.MinTeamSize);
        const need = missing > 0 ? `: потрібно ще ${missing} ${pluralUk(missing, "учасник", "учасники", "учасників")}` : "";
        return <Page banners={<EventBanner tone="warning" title={`Команду не допущено${need}`} message="Завдання недоступні, доки склад команди не відповідає вимогам. Результати можна переглядати." action={<Link className="ib-btn ib-btn--sm" href="/participation">Моя участь</Link>} />} />;
    }
    if (!started) return <Page><div className="event-challenges__countdown"><CountdownTimer text="Завдання стануть доступні через" until={new Date(event.StartTime)} /></div></Page>;
    if (challenges.isPending) return <EventLoading label="Завантажуємо завдання…" />;
    if (challenges.isError) return <Page banners={finishedBanner || undefined}><Empty title="Не вдалося завантажити завдання">Перевірте з’єднання. <button type="button" className="ib-btn ib-btn--sm" onClick={() => void challenges.refetch()}>Повторити</button></Empty></Page>;

    return <Board eventID={event.EventID} mode="participant" challenges={challenges.data} teamMode={teamMode} finished={finished}
        showDifficulty={info?.ShowDifficulty ?? true} showHints={info?.ShowHints ?? true} userID={user.data?.ID}
        onRefresh={() => void challenges.refetch()} banners={finishedBanner || undefined} />;
}
