"use client";

import {useState} from "react";
import {useInfiniteQuery} from "@tanstack/react-query";
import {X} from "lucide-react";
import {getManageParticipants} from "@/api/manageParticipants";
import {getManageTeams} from "@/api/manageTeams";
import type {BroadcastAudience} from "@/api/manageBroadcasts";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventCheckbox} from "@/components/ui/EventCheckbox";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {ManageTableSearch} from "../ManageTable";
import {useDebounced} from "../notifications/useDebounced";
import {audienceKindOptions} from "./broadcastModel";
import "./broadcasts.css";

type Row = {id: string; title: string; hint: string};
const PAGE = 50;

// A searchable, checkable list of a fixed height: loading, empty and error
// states sit centered in the same block, so it never changes size.
function PickList({event, label, rows, selected, onToggle, search, onSearch, state, error, onRetry, hasMore, onMore, moreBusy, emptyMessage, loadingLabel, errorMessage}: {
    event: PublicEventInfo; label: string; rows: Row[]; selected: string[]; onToggle: (row: Row, checked: boolean) => void;
    search: string; onSearch: (value: string) => void; state: "loading" | "error" | "empty" | "ready"; error?: unknown; onRetry: () => void;
    hasMore: boolean; onMore: () => void; moreBusy: boolean; emptyMessage: string; loadingLabel: string; errorMessage: string;
}) {
    return <div className="event-broadcast-picker">
        <ManageTableSearch value={search} onChange={onSearch} label={label} />
        <div className="event-broadcast-picker__list" aria-busy={state === "loading"}>
            {state === "loading" ? <EventLoading event={event} label={loadingLabel} compact />
                : state === "error" ? <EventLoadError message={errorMessage} error={error} onRetry={onRetry} compact />
                    : state === "empty" ? <EmptyState message={emptyMessage} compact />
                        : <ul>{rows.map(row => <li key={row.id}>
                            <EventCheckbox checked={selected.includes(row.id)} onCheckedChange={checked => onToggle(row, checked)} label={<span className="event-broadcast-picker__row"><span>{row.title}</span>{row.hint && <small>{row.hint}</small>}</span>} />
                        </li>)}
                        {hasMore && <li><button className="ib-btn ib-btn--sm" type="button" disabled={moreBusy} onClick={onMore}>{t("manage.broadcasts.picker.more")}</button></li>}</ul>}
        </div>
    </div>;
}

// Chips of the picked items with a way to drop each one.
function Picked({ids, names, onRemove, removeLabel}: {ids: string[]; names: Record<string, string>; onRemove: (id: string) => void; removeLabel: (name: string) => string}) {
    if (ids.length === 0) return null;
    return <ul className="event-broadcast-picked" aria-label={t("manage.broadcasts.picker.selected", {count: ids.length})}>
        {ids.map(id => <li key={id} className="ib-tag"><span>{names[id] ?? id}</span>
            <button type="button" className="event-broadcast-picked__remove" aria-label={removeLabel(names[id] ?? id)} onClick={() => onRemove(id)}><X size={12} aria-hidden="true" /></button></li>)}
    </ul>;
}

function toggled(ids: string[], id: string, checked: boolean): string[] {
    return checked ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter(item => item !== id);
}

export function AudiencePicker({event, value, onChange, disabled = false}: {event: PublicEventInfo; value: BroadcastAudience; onChange: (audience: BroadcastAudience) => void; disabled?: boolean}) {
    const eventID = event.EventID;
    const [names, setNames] = useState<Record<string, string>>({});
    const [teamSearch, setTeamSearch] = useState("");
    const [personSearch, setPersonSearch] = useState("");
    const teamTerm = useDebounced(teamSearch, 300);
    const personTerm = useDebounced(personSearch, 300);
    const remember = (entries: Array<[string, string]>) => setNames(current => entries.some(([id, name]) => current[id] !== name) ? {...current, ...Object.fromEntries(entries)} : current);

    const teams = useInfiniteQuery({
        queryKey: ["event-broadcast-teams", eventID, teamTerm], enabled: value.Kind === "teams", refetchOnWindowFocus: false,
        initialPageParam: null as string | null,
        queryFn: async ({pageParam}) => {
            const page = await getManageTeams(eventID, pageParam, {search: teamTerm}, PAGE);
            remember(page.Items.map(team => [team.ID, team.Name]));
            return page;
        },
        getNextPageParam: page => page.NextCursor ?? null,
    });
    const people = useInfiniteQuery({
        queryKey: ["event-broadcast-participants", eventID, personTerm], enabled: value.Kind === "participants", refetchOnWindowFocus: false,
        initialPageParam: null as string | null,
        queryFn: async ({pageParam}) => {
            const page = await getManageParticipants(eventID, {search: personTerm}, pageParam, PAGE);
            remember(page.Items.map(item => [item.UserID, item.DisplayName || item.Name || item.Email]));
            return page;
        },
        getNextPageParam: page => page.NextCursor ?? null,
    });

    const kindOptions = audienceKindOptions.map(kind => ({value: kind, label: t(`manage.broadcasts.audience.${kind}`)}));
    const teamRows: Row[] = (teams.data?.pages ?? []).flatMap(page => page.Items).map(team => ({id: team.ID, title: team.Name, hint: t("manage.broadcasts.picker.members", {count: team.MemberCount})}));
    const personRows: Row[] = (people.data?.pages ?? []).flatMap(page => page.Items).map(item => ({id: item.UserID, title: item.DisplayName || item.Name || item.Email, hint: item.Email}));
    const listState = (query: {isPending: boolean; isError: boolean}, rows: Row[]) => query.isPending ? "loading" as const : query.isError ? "error" as const : rows.length === 0 ? "empty" as const : "ready" as const;

    return <div className="event-broadcast-audience" {...(disabled ? {inert: true} : {})}>
        <div className="event-manage-field">
            <ManageFieldLabel title={t("manage.broadcasts.audience.label")} help={t("manage.broadcasts.audience.help")} required />
            <EventSelect ariaLabel={t("manage.broadcasts.audience.label")} value={value.Kind} options={kindOptions}
                onValueChange={Kind => onChange({Kind, Roles: [], UserIDs: value.UserIDs, TeamIDs: value.TeamIDs})} />
        </div>
        {value.Kind === "teams" && <>
            <Picked ids={value.TeamIDs} names={names} removeLabel={name => t("manage.broadcasts.picker.remove", {name})} onRemove={id => onChange({...value, TeamIDs: toggled(value.TeamIDs, id, false)})} />
            <PickList event={event} label={t("manage.broadcasts.picker.searchTeams")} rows={teamRows} selected={value.TeamIDs} search={teamSearch} onSearch={setTeamSearch}
                onToggle={(row, checked) => onChange({...value, TeamIDs: toggled(value.TeamIDs, row.id, checked)})}
                state={listState(teams, teamRows)} error={teams.error} onRetry={() => void teams.refetch()} hasMore={!!teams.hasNextPage} onMore={() => void teams.fetchNextPage()} moreBusy={teams.isFetchingNextPage}
                emptyMessage={t("manage.broadcasts.picker.noTeams")} loadingLabel={t("manage.broadcasts.picker.loading")} errorMessage={t("manage.broadcasts.picker.teamsError")} />
        </>}
        {value.Kind === "participants" && <>
            <Picked ids={value.UserIDs} names={names} removeLabel={name => t("manage.broadcasts.picker.remove", {name})} onRemove={id => onChange({...value, UserIDs: toggled(value.UserIDs, id, false)})} />
            <PickList event={event} label={t("manage.broadcasts.picker.searchPeople")} rows={personRows} selected={value.UserIDs} search={personSearch} onSearch={setPersonSearch}
                onToggle={(row, checked) => onChange({...value, UserIDs: toggled(value.UserIDs, row.id, checked)})}
                state={listState(people, personRows)} error={people.error} onRetry={() => void people.refetch()} hasMore={!!people.hasNextPage} onMore={() => void people.fetchNextPage()} moreBusy={people.isFetchingNextPage}
                emptyMessage={t("manage.broadcasts.picker.noPeople")} loadingLabel={t("manage.broadcasts.picker.loading")} errorMessage={t("manage.broadcasts.picker.peopleError")} />
        </>}
    </div>;
}
