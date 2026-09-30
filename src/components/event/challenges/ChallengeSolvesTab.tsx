"use client";

import {useEffect, useRef, useState} from "react";
import {useInfiniteQuery} from "@tanstack/react-query";
import {Trophy} from "lucide-react";
import {ApiErrorCode} from "@/api/apiErrors";
import {getChallengeSolves, ParticipantChallengeError, type ChallengeSolve} from "@/api/participantChallenges";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {exactTime, relativeTime} from "@/components/event/participation/participationStatsModel";
import {t} from "@/i18n/t";

// Fixed row and viewport height: the list is windowed, so a long list renders a
// screenful of rows, and the tab never changes size between loading, empty and data.
export const SOLVE_ROW_HEIGHT = 40;
export const SOLVES_VIEWPORT = 320;
const OVERSCAN = 6;

const deniedMessages: Record<number, string> = {
    [ApiErrorCode.ResultsHidden]: "challenges.solves.denied.hidden",
    [ApiErrorCode.ResultsParticipantsOnly]: "challenges.solves.denied.participantsOnly",
    [ApiErrorCode.ResultsNotStarted]: "challenges.solves.denied.notStarted",
};

// The rows worth rendering for a scroll offset.
export function solvesWindow(total: number, scrollTop: number): {start: number; end: number} {
    const start = Math.max(0, Math.floor(scrollTop / SOLVE_ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(total, Math.ceil((scrollTop + SOLVES_VIEWPORT) / SOLVE_ROW_HEIGHT) + OVERSCAN);
    return {start, end};
}

function SolveTime({iso, now}: {iso: string; now: number}) {
    return <EventTooltip content={exactTime(iso)}>{id => <time className="ib-solvers__time" dateTime={iso} aria-describedby={id} tabIndex={0}>{relativeTime(iso, now)}</time>}</EventTooltip>;
}

function SolveRow({row, index, now}: {row: ChallengeSolve; index: number; now: number}) {
    return <li className={`ib-solvers__row${row.Own ? " is-own" : ""}`} style={{top: index * SOLVE_ROW_HEIGHT, height: SOLVE_ROW_HEIGHT}}>
        <span className="ib-solvers__n">{index + 1}</span>
        <span className="ib-solvers__name">
            <EventTooltip content={row.TeamName} truncated className="ib-solvers__tip">{() => <span>{row.TeamName}</span>}</EventTooltip>
            {row.FirstBlood && <span className="ib-tag ib-tag--sm ib-tag--warn"><Trophy size={12} aria-hidden="true" />{t("participation.solves.firstBlood")}</span>}
            {row.Own && <span className="ib-tag ib-tag--sm">{t("challenges.solves.own")}</span>}
        </span>
        <SolveTime iso={row.SolvedAt} now={now} />
    </li>;
}

// «Розв'язання» tab of the challenge modal: who solved it, first solves on top.
// Pages load as the list reaches its end (IntersectionObserver on a sentinel).
export function ChallengeSolvesTab({eventID, challengeID, moderators, enabled}: {eventID: string; challengeID: string; moderators: boolean; enabled: boolean}) {
    const query = useInfiniteQuery({
        queryKey: ["event-challenge-solves", moderators ? "moderators" : "participant", eventID, challengeID],
        queryFn: ({pageParam}) => getChallengeSolves(eventID, challengeID, pageParam, moderators),
        initialPageParam: null as string | null,
        getNextPageParam: page => page.NextCursor,
        enabled, retry: false, refetchOnWindowFocus: false,
    });
    const scroller = useRef<HTMLDivElement>(null);
    const sentinel = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [now] = useState(() => Date.now());
    const rows = query.data?.pages.flatMap(page => page.Items) ?? [];
    const {hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage} = query;
    const loadMore = hasNextPage && !isFetchingNextPage && !isFetchNextPageError;

    useEffect(() => {
        const node = sentinel.current;
        if (!node || !loadMore) return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) void fetchNextPage();
        }, {root: scroller.current, rootMargin: `${SOLVE_ROW_HEIGHT * 4}px`});
        observer.observe(node);
        return () => observer.disconnect();
    }, [loadMore, fetchNextPage, rows.length]);

    let body;
    if (query.isPending) {
        body = <EventLoading compact label={t("challenges.solves.loading")} />;
    } else if (query.isError) {
        const code = query.error instanceof ParticipantChallengeError ? query.error.code : undefined;
        const denied = code !== undefined ? deniedMessages[code] : undefined;
        body = denied
            ? <EmptyState compact message={t(denied)} />
            : <EventLoadError compact message={t("challenges.solves.unavailableTitle")} error={query.error} onRetry={() => void query.refetch()} />;
    } else if (!rows.length) {
        body = <EmptyState compact message={t("challenges.solves.emptyMessage")} />;
    } else {
        const {start, end} = solvesWindow(rows.length, scrollTop);
        body = <div ref={scroller} className="ib-solvers__scroll" onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
            <ul className="ib-solvers__list" style={{height: rows.length * SOLVE_ROW_HEIGHT}} aria-label={t("challenges.solves.listLabel")}>
                {rows.slice(start, end).map((row, offset) => <SolveRow key={`${row.TeamName}-${row.SolvedAt}-${start + offset}`} row={row} index={start + offset} now={now} />)}
            </ul>
            {(hasNextPage || isFetchNextPageError) && <div className="ib-solvers__more">
                {isFetchNextPageError
                    ? <button type="button" className="ib-btn ib-btn--sm" onClick={() => void fetchNextPage()}>{t("error.load.retry")}</button>
                    : <div ref={sentinel} className="ib-solvers__sentinel" aria-hidden="true" />}
            </div>}
        </div>;
    }
    return <div className="ib-solvers">{body}</div>;
}
