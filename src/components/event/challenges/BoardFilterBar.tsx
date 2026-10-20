"use client";

import {useRef, useState} from "react";
import * as Popover from "@radix-ui/react-popover";
import {Check, ChevronDown, Tag} from "lucide-react";
import {EmptyState} from "@/components/ui/EmptyState";
import type {BoardStage} from "@/api/participantChallenges";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {UNSTAGED, type BoardFilters, type BoardStatus, type BoardGroup, solvedCount} from "./challengeBoardModel";

// The board filters that belong to the page: the status segments and the stage (only when the event has stages).
// Group counts always include all tasks, independent of the selected status.
export function BoardFilterBar({filters, stages, groups, hasClosed, hasUnstaged, onChange}: {filters: BoardFilters; stages: BoardStage[]; groups: BoardGroup[]; hasClosed: boolean; hasUnstaged: boolean; onChange: (filters: BoardFilters) => void}) {
    const stageOptions = [
        {value: "", label: t("challenges.filter.stage.all")},
        ...(hasUnstaged ? [{value: UNSTAGED, label: t("challenges.filter.stage.none")}] : []),
        ...stages.map(stage => ({value: stage.ID, label: stage.Name})),
    ];
    const statusOptions: {value: BoardStatus; label: string}[] = [
        {value: "open", label: t("challenges.filter.status.open")},
        {value: "solved", label: t("challenges.filter.status.solved")},
        ...(hasClosed ? [{value: "closed" as const, label: t("challenges.filter.status.closed")}] : []),
        {value: "", label: t("challenges.filter.status.all")},
    ];
    return <div className="event-board-filters" role="group" aria-label={t("challenges.filter.aria")}>
        <div className="ib-seg ib-seg--sm" role="group" aria-label={t("challenges.filter.status")}>
            {statusOptions.map(option =>
                <button key={option.value} type="button" aria-pressed={filters.status === option.value} onClick={() => onChange({...filters, status: option.value})}>{option.label}</button>)}
        </div>
        <GroupSelect groups={groups} value={filters.group} onChange={group => onChange({...filters, group})} />
        {stages.length > 0 && <EventSelect className="event-board-filters__select" ariaLabel={t("challenges.filter.stage")} value={filters.stage} options={stageOptions} onValueChange={stage => onChange({...filters, stage})} />}
    </div>;
}

function GroupSelect({groups, value, onChange}: {groups: BoardGroup[]; value: string[]; onChange: (value: string[]) => void}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const optionsRef = useRef<HTMLDivElement>(null);
    const selected = groups.filter(group => value.includes(group.key));
    const options = groups.filter(group => group.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    const select = (key: string) => onChange(value.includes(key) ? value.filter(item => item !== key) : [...value, key]);
    const label = selected.length > 1 ? t("challenges.board.selectedGroups", {count: selected.length}) : selected[0]?.name ?? t("challenges.filter.status.all");
    return <Popover.Root open={open} onOpenChange={next => {setOpen(next); if (!next) setQuery("");}}>
        <Popover.Trigger className="event-board__select ib-select__trigger" aria-label={t("challenges.board.group")}><Tag size={14} aria-hidden="true" /><span><small className="event-board__group-label">{t("challenges.board.group")}</small> {label}</span>{selected.length === 1 && <span className="ib-num">{solvedCount(selected[0].challenges)}</span>}<ChevronDown size={14} aria-hidden="true" /></Popover.Trigger>
        <Popover.Portal><Popover.Content className="ib-listbox event-board__groups" align="start" sideOffset={4} collisionPadding={8} onOpenAutoFocus={event => {event.preventDefault(); input.current?.focus();}}>
            <input ref={input} type="search" className="ib-input" value={query} aria-label={t("challenges.board.findGroup")} placeholder={t("challenges.board.findGroup")} onChange={event => setQuery(event.target.value)} onKeyDown={event => {if (event.key === "ArrowDown") {event.preventDefault(); optionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus();}}} />
            <div ref={optionsRef} className="event-board__group-options" role="group" aria-label={t("challenges.board.group")} onKeyDown={event => {
                const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
                const index = items.indexOf(document.activeElement as HTMLButtonElement);
                const next = event.key === "ArrowDown" ? (index + 1) % items.length : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
                if (next >= 0) {event.preventDefault(); items[next]?.focus();}
            }}>
                <button type="button" className="ib-listbox__opt event-board__group" aria-pressed={!value.length} onClick={() => onChange([])}><span>{t("challenges.board.allGroups")}</span><span className="ib-num">{solvedCount(groups.flatMap(group => group.challenges))}</span>{!value.length && <Check size={14} aria-hidden="true" />}</button>
                {options.map(option => <button type="button" role="checkbox" aria-checked={value.includes(option.key)} className="ib-listbox__opt event-board__group" key={option.key} onClick={() => select(option.key)}><span className="event-board__group-check" aria-hidden="true">{value.includes(option.key) && <Check size={12} />}</span><span>{option.name}</span><span className="ib-num">{solvedCount(option.challenges)}</span></button>)}
                {!options.length && <EmptyState compact message={t("common.noOptions")} />}
            </div>
        </Popover.Content></Popover.Portal>
    </Popover.Root>;
}
