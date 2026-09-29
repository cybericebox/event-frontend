"use client";

import {useEffect, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {attemptsLiveURL} from "@/api/manageAttempts";
import {useEventStream} from "@/utils/eventStream";
import {getHintUnlocks, type HintUnlock} from "@/api/manageChallenges";
import {hintCostLabel} from "@/components/event/challenges/hintModel";
import {EventSelect} from "@/components/ui/EventSelect";
import {parseLocal, zoneLabel} from "@/components/ui/dateTimePicker";
import {useManager} from "./ManagerShell";
import {journalTime, PeriodFilters, useJournalOptions} from "./journalShared";
import {MANAGE_PAGE_SIZES, ManageTable, ManageTablePagination} from "./ManageTable";
import type {DataFreshness} from "./LiveStatus";
import {t} from "@/i18n/t";

const all = "all";

export type HintFilters = {teamID: string | null; participantID: string | null; challengeID: string | null; from: string; to: string};
export const emptyHintFilters: HintFilters = {teamID: null, participantID: null, challengeID: null, from: "", to: ""};

// The API returns the whole log (newest first); filters apply here. Period
// bounds are the picker's local values: from inclusive, to exclusive.
export function filterHintUnlocks(items: HintUnlock[], filters: HintFilters): HintUnlock[] {
    const from = parseLocal(filters.from)?.getTime() ?? null;
    const to = parseLocal(filters.to)?.getTime() ?? null;
    return items.filter(item => {
        const at = Date.parse(item.UnlockedAt);
        return (!filters.teamID || item.TeamID === filters.teamID)
            && (!filters.participantID || item.UnlockedBy === filters.participantID)
            && (!filters.challengeID || item.EventChallengeID === filters.challengeID)
            && (from === null || at >= from) && (to === null || at < to);
    });
}

// «Підказки» view of «Журнал спроб»: who opened which hint, when and for how much.
// Silent fallback while the journal stream reconnects.
const HINTS_POLL_SECONDS = 30;

export function HintUnlocksLog({onStatus}: {onStatus?: (status: {freshness: DataFreshness; updatedAt: number}) => void}) {
    const {event} = useManager();
    const teamMode = event.Participation === 1;
    const options = useJournalOptions();
    const [filters, setFilters] = useState<HintFilters>(emptyHintFilters);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(MANAGE_PAGE_SIZES[0]);
    const queryClient = useQueryClient();
    const [aliveAt, setAliveAt] = useState(0);
    // Realtime: the journal stream says "hints-changed", the list reloads.
    const stream = useEventStream({url: () => attemptsLiveURL(event.EventID), events: ["hints-changed"], onChange: () => void queryClient.invalidateQueries({queryKey: ["event-hint-unlocks", event.EventID]}), onAlive: () => setAliveAt(Date.now()), enabled: true});
    const unlocks = useQuery({queryKey: ["event-hint-unlocks", event.EventID], queryFn: () => getHintUnlocks(event.EventID), refetchInterval: stream === "fallback" ? HINTS_POLL_SECONDS * 1000 : false, refetchOnWindowFocus: false});
    const updatedAt = Math.max(unlocks.dataUpdatedAt, aliveAt);
    useEffect(() => {onStatus?.({freshness: {kind: "stream", mode: stream, pollSeconds: HINTS_POLL_SECONDS}, updatedAt});}, [onStatus, stream, updatedAt]);
    const matching = filterHintUnlocks(unlocks.data ?? [], filters);
    const pages = Math.max(1, Math.ceil(matching.length / pageSize));
    const current = Math.min(page, pages);
    const rows = matching.slice((current - 1) * pageSize, current * pageSize);
    const filtered = filters.teamID !== null || filters.participantID !== null || filters.challengeID !== null || !!filters.from || !!filters.to;
    const busy = unlocks.isFetching && !!unlocks.data;
    const state = unlocks.isPending ? "loading" : unlocks.isError && !unlocks.data ? "error" : rows.length === 0 ? "empty" : "ready";
    const {offset} = zoneLabel();

    function changeFilters(patch: Partial<HintFilters>) {
        setFilters(value => ({...value, ...patch}));
        setPage(1);
    }

    const toolbar = <>
        <EventSelect ariaLabel={teamMode ? t("manage.attempts.team") : t("manage.attempts.participant")} value={filters.teamID ?? all} options={options.teams} onValueChange={value => changeFilters({teamID: value === all ? null : value})} />
        {teamMode && <EventSelect ariaLabel={t("manage.attempts.participant")} value={filters.participantID ?? all} options={options.participants} onValueChange={value => changeFilters({participantID: value === all ? null : value})} />}
        <EventSelect ariaLabel={t("manage.attempts.challenge")} value={filters.challengeID ?? all} options={options.challenges} onValueChange={value => changeFilters({challengeID: value === all ? null : value})} />
        <PeriodFilters from={filters.from} to={filters.to} onChange={changeFilters} />
        {filtered && <button className="ib-btn ib-btn--sm" type="button" onClick={() => changeFilters(emptyHintFilters)}>{t("manage.attempts.filter.reset")}</button>}
    </>;

    return <ManageTable event={event} state={state} busy={busy} loadingLabel={t("manage.hints.loading")} emptyMessage={filtered ? t("manage.hints.emptyFiltered") : t("manage.hints.empty")} errorMessage={t("manage.hints.loadFailed")} onRetry={() => void unlocks.refetch()}
        toolbar={toolbar}
        head={<tr>
            <th scope="col">{t("manage.attempts.col.time", {offset})}</th>
            <th scope="col">{teamMode ? t("manage.hints.col.team") : t("manage.hints.col.participant")}</th>
            <th scope="col">{t("manage.hints.col.challenge")}</th>
            <th scope="col">{t("manage.hints.col.hint")}</th>
            {teamMode && <th scope="col">{t("manage.hints.col.openedBy")}</th>}
            <th scope="col" className="ib-num">{t("manage.hints.col.cost")}</th>
        </tr>}
        footer={<ManageTablePagination event={event} page={current} pageSize={pageSize} total={matching.length} hasNext={current < pages} busy={busy} onPrevious={() => setPage(current - 1)} onNext={() => setPage(current + 1)} onPageSize={size => { setPageSize(size); setPage(1); }} />}>
        <tbody>{rows.map(item => <tr key={`${item.TeamID}-${item.HintID}`}>
            <td className="event-manage-table__nowrap"><time dateTime={item.UnlockedAt}>{journalTime.format(new Date(item.UnlockedAt))}</time></td>
            <td>{item.TeamName}</td>
            <td>{item.ChallengeName || t("manage.hints.col.challenge")}</td>
            <td>{t("manage.hints.hintNumber", {number: item.HintIndex + 1})}</td>
            {teamMode && <td>{item.UnlockedByName || <span className="event-manage-table__dim">{t("manage.journal.none")}</span>}</td>}
            <td className="ib-num">{hintCostLabel(item.Cost)}</td>
        </tr>)}</tbody>
    </ManageTable>;
}
