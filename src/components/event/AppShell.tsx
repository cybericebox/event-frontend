"use client";

import {type ReactNode, useSyncExternalStore} from "react";
import {EventErrorScreen} from "@/components/event/EventErrorScreen";
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
import {EventServiceStatusGate, APP_ROOT_ID} from "./EventServiceStatusGate";
import {OutageShell} from "./OutageShell";
import {reservedPageSlugs} from "./content/pageSlugs";
import {EventUnavailableScreen} from "./EventUnavailableScreen";
import {SignInRedirect} from "./SignInRedirect";
import {needsSession} from "@/utils/sessionRoutes";
import {isEventGone, subscribeEventGone} from "@/utils/eventGone";
import {t} from "@/i18n/t";

type Props = {
    children: ReactNode;
    event: PublicEventInfo | null;
    unavailable: boolean;
};

// The outage modal is mounted once over every shell state; the page stays underneath.
export function AppShell(props: Props) {
    // The event was deleted while the site was open: the same screen as for an event that never existed.
    const gone = useSyncExternalStore(subscribeEventGone, isEventGone, () => false);
    if (gone) return <EventUnavailableScreen />;
    return <>
        <div id={APP_ROOT_ID}><ShellContent {...props} /></div>
        <EventServiceStatusGate serverUnavailable={props.unavailable} />
    </>;
}

function ShellContent({children, event, unavailable}: Props) {
    const pathname = usePathname();
    const isManagement = pathname === "/manage" || pathname.startsWith("/manage/");
    const isLive = pathname === "/live";
    const slug = pathname.slice(1);
    // Pages a guest reads too: while the account loads they stay in the guest frame (navbar and footer
    // in place) instead of flashing the full-page loader. /join and /invite are guest pages for the same reason.
    const isContentPage = pathname === "/" || pathname.startsWith("/p/") || pathname === "/scoreboard" || pathname === "/join" || pathname === "/invite" || (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !reservedPageSlugs.has(slug));
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
        // The server-side event fetch failed: no event data, so the bare frame with the
        // platform crest stays under the outage modal until the event loads again.
        return <OutageShell manage={isManagement} />;
    }
    if (!event) {
        if (isManagement) return <ManagerBootstrap>{children}</ManagerBootstrap>;
        if (isLive) return children;
        // Server reads are anonymous, so an unpublished event is absent here. Every other route
        // retries in the browser with the session; the bootstrap shows the one
        // «not found or no access» screen when the browser answer is no either.
        return <PrivateEventBootstrap>{children}</PrivateEventBootstrap>;
    }
    if (isLive) return children;
    // A session page of a visible event opened without a session goes to the sign-in at once.
    if (needsSession(pathname) && currentUser.isSuccess && !currentUser.data) return <SignInRedirect event={event} />;
    if (isManagement) return <ManagerShell event={event}>{children}</ManagerShell>;
    // Public content is already in the server response. Keep it visible while
    // browser-only account and team requests finish.
    const identityPending = currentUser.isPending || (!!currentUser.data && joinStatus.isPending) || (approved && (participantInfo.isPending || ownTeam.isPending));
    if (isContentPage && (!approved || participantInfo.isPending || ownTeam.isPending || currentUser.isError || joinStatus.isError || participantInfo.isError || ownTeam.isError)) {
        return <GuestShell event={event} authenticated={!!currentUser.data} joinStatus={joinStatus.data} pending={identityPending}>{children}</GuestShell>;
    }
    if (identityPending) {
        return <EventLoading event={event} full label={t("shell.loadingEventFull")} />;
    }
    if (currentUser.isError || joinStatus.isError || (approved && (participantInfo.isError || ownTeam.isError))) {
        return <EventErrorScreen page title={t("shell.accessFailed.title")} body={t("shell.accessFailed.body")} error={currentUser.error ?? joinStatus.error ?? participantInfo.error ?? ownTeam.error} onRetry={() => void (currentUser.isError ? currentUser.refetch() : joinStatus.isError ? joinStatus.refetch() : participantInfo.isError ? participantInfo.refetch() : ownTeam.refetch())} />;
    }
    const authenticated = !!currentUser.data;
    if (approved && participantInfo.data?.EventID !== event.EventID) {
        return <EventErrorScreen title={t("shell.eventFailed")} onRetry={() => window.location.reload()} page />;
    }
    return approved && !!participantInfo.data
        ? <ParticipantShell event={event} participantInfo={participantInfo.data} ownTeam={ownTeam.data ?? null}>{children}</ParticipantShell>
        : <GuestShell event={event} authenticated={authenticated} joinStatus={joinStatus.data}>{children}</GuestShell>;
}
