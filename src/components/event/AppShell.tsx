"use client";

import {type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {getCurrentUser, getJoinStatus, getOwnTeam} from "@/api/clientAuth";
import {getParticipantEventInfo} from "@/api/participantEventInfo";
import {ParticipationStatusEnum} from "@/types/event";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {usePathname} from "next/navigation";
import {GuestShell} from "./GuestShell";
import {ParticipantShell} from "./ParticipantShell";
import {ManagerShell} from "./manage/ManagerShell";
import {ManagerBootstrap} from "./manage/ManagerBootstrap";
import {PrivateEventBootstrap} from "./PrivateEventBootstrap";
import {EventLoading} from "./EventLoading";

export function AppShell({children, event, unavailable}: {
    children: ReactNode;
    event: PublicEventInfo | null;
    unavailable: boolean;
}) {
    const pathname = usePathname();
    const isManagement = pathname === "/manage" || pathname.startsWith("/manage/");
    const isLive = pathname === "/live";
    const currentUser = useQuery({
        queryKey: ["event-current-user"], queryFn: getCurrentUser,
        enabled: !!event && !unavailable && !isManagement && !isLive,
        retry: false, refetchInterval: false, refetchOnWindowFocus: false,
    });
    const joinStatus = useQuery({
        queryKey: ["event-join-status", event?.EventID], queryFn: getJoinStatus,
        enabled: !!currentUser.data && !!event && !unavailable && !isManagement && !isLive,
        retry: false, refetchInterval: false, refetchOnWindowFocus: false,
    });
    const approved = !!currentUser.data && joinStatus.data === ParticipationStatusEnum.ApprovedParticipationStatus;
    const participantInfo = useQuery({
        queryKey: ["event-participant-info", event?.EventID], queryFn: getParticipantEventInfo,
        enabled: approved && !!event && !unavailable && !isManagement && !isLive,
        retry: false, refetchInterval: false, refetchOnWindowFocus: false,
    });
    const ownTeam = useQuery({
        queryKey: ["event-own-team", event?.EventID], queryFn: () => getOwnTeam(event!.EventID),
        enabled: approved && !!event && !unavailable && !isManagement && !isLive,
        retry: false, refetchInterval: false, refetchOnWindowFocus: false,
    });

    if (unavailable) {
        return <div className="event-shell-state" role="status">
            <h1>Сервер події тимчасово недоступний</h1>
            <p>Спробуйте відновити сторінку трохи пізніше.</p>
            <button className="ib-btn" onClick={() => window.location.reload()}>Повторити</button>
        </div>;
    }
    if (!event) {
        if (isManagement) return <ManagerBootstrap>{children}</ManagerBootstrap>;
        if (pathname === "/" || pathname.startsWith("/p/")) return <PrivateEventBootstrap>{children}</PrivateEventBootstrap>;
        return <div className="event-shell-state"><h1>Подію не знайдено</h1></div>;
    }
    if (isLive) return children;
    if (isManagement) return <ManagerShell event={event}>{children}</ManagerShell>;
    if (currentUser.isPending || (!!currentUser.data && joinStatus.isPending) || (approved && (participantInfo.isPending || ownTeam.isPending))) {
        return <EventLoading event={event} full label="Завантаження події…" />;
    }
    if (currentUser.isError || joinStatus.isError || (approved && (participantInfo.isError || ownTeam.isError))) {
        return <div className="event-shell-state" role="status">
            <h1>Не вдалося перевірити доступ</h1>
            <p>Ваші дані збережені. Спробуйте повторити запит.</p>
            <button className="ib-btn" onClick={() => void (currentUser.isError ? currentUser.refetch() : joinStatus.isError ? joinStatus.refetch() : participantInfo.isError ? participantInfo.refetch() : ownTeam.refetch())}>Повторити</button>
        </div>;
    }
    const authenticated = !!currentUser.data;
    if (approved && participantInfo.data?.EventID !== event.EventID) {
        return <div className="event-shell-state" role="alert"><h1>Не вдалося перевірити подію</h1></div>;
    }
    return approved && !!participantInfo.data
        ? <ParticipantShell event={event} participantInfo={participantInfo.data} ownTeam={ownTeam.data ?? null}>{children}</ParticipantShell>
        : <GuestShell event={event} authenticated={authenticated} joinStatus={joinStatus.data}>{children}</GuestShell>;
}
