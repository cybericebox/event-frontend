"use client";

import {useEffect, useRef, useState, type RefObject} from "react";
import {EmptyState} from "@/components/ui/EmptyState";
import type {OwnChallenge} from "@/api/participantChallenges";
import {ChallengeTile} from "./ChallengeTile";
import {t, tPlural} from "@/i18n/t";
import {formatPoints, matchesBoard, restPoints, solvedCount, type BoardCategory} from "./challengeBoardModel";
import {richMessage} from "./richMessage";
import {EventTooltip} from "@/components/ui/EventTooltip";

type OpenHandler = (challenge: OwnChallenge, tile: HTMLButtonElement) => void;
// toolbar: the stage and status filters the page owns; category is the selected category key ("" = all), kept in the URL.
type BoardProps = {categories: BoardCategory[]; acceptedID: string | null; onOpen: OpenHandler; toolbar?: React.ReactNode; category: string; onCategory: (key: string) => void; emptyMessage: string; onResetFilters?: () => void};

const SEARCH = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>;

function typing(): boolean {
    const active = document.activeElement as HTMLElement | null;
    return !!active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
}

// «/» focuses the search, like IB.ChallengeBoard; ignored while typing or with a dialog open.
function useSlashSearch(input: RefObject<HTMLInputElement | null>) {
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || typing() || document.querySelector("dialog[open]")) return;
            event.preventDefault();
            input.current?.focus();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [input]);
}

function Search({value, onChange, inputRef, className = ""}: {value: string; onChange: (value: string) => void; inputRef: RefObject<HTMLInputElement | null>; className?: string}) {
    return <label className={`ib-input-wrap ib-input-wrap--search ${className}`}>
        {SEARCH}
        <input ref={inputRef} className="ib-input" type="search" placeholder={t("challenges.board.search")} aria-label={t("challenges.board.search")} autoComplete="off" value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={event => { if (event.key === "Escape" && value) { event.stopPropagation(); onChange(""); } }} />
        <kbd className="ib-kbd" aria-hidden="true">/</kbd>
    </label>;
}

function Empty({query, className, category, emptyMessage, onReset, onResetFilters}: {query: string; className: string; category?: string; emptyMessage: string; onReset?: () => void; onResetFilters?: () => void}) {
    const q = query.trim();
    const message = q
        ? category ? t("challenges.board.empty.queryInCategory", {category, query: q}) : t("challenges.board.empty.query", {query: q})
        : emptyMessage;
    return <div className={className}>
        <EmptyState message={message} />
        {q && onReset && <button type="button" className="ib-btn ib-btn--sm" onClick={onReset}>{t("challenges.board.resetSearch")}</button>}
        {!q && onResetFilters && <button type="button" className="ib-btn ib-btn--sm" onClick={onResetFilters}>{t("challenges.filter.reset")}</button>}
    </div>;
}

// «Плитки» — React port of ds-v2 IB.ChallengeBoard: filter, category chips, search, sticky «4 / 10» headers.
export function TilesBoard({categories, acceptedID, onOpen, toolbar, category, onCategory, emptyMessage, onResetFilters}: BoardProps) {
    const [query, setQuery] = useState("");
    const search = useRef<HTMLInputElement>(null);
    useSlashSearch(search);
    const all = categories.flatMap(item => item.challenges);
    const shown = categories
        .filter(item => !category || item.key === category)
        .map(item => ({...item, visible: item.challenges.filter(challenge => matchesBoard(challenge, query, item.name))}))
        .filter(item => item.visible.length > 0);
    return <div className="ib-board event-board">
        <div className="ib-board__bar">
            {toolbar}
            <div className="ib-board__chips" role="group" aria-label={t("challenges.board.category")}>
                <button type="button" className="ib-board__chip" aria-pressed={category === ""} onClick={() => onCategory("")}>{t("challenges.board.allCategories")}<span className="ib-num">{solvedCount(all)}</span></button>
                {categories.map(item => <button key={item.key} type="button" className="ib-board__chip" aria-pressed={category === item.key} onClick={() => onCategory(item.key)}><EventTooltip truncated placement="bottom" content={item.name}>{() => <span className="ib-board__chip-name">{item.name}</span>}</EventTooltip><span className="ib-num">{solvedCount(item.challenges)}</span></button>)}
            </div>
            <Search value={query} onChange={setQuery} inputRef={search} className="ib-board__search" />
        </div>
        <div className="ib-board__body">
            {shown.map(item => <section key={item.key} className="ib-board__sec" aria-label={item.name}>
                <header className="ib-board__cat">
                    <EventTooltip truncated placement="bottom" content={item.name}>{() => <h3>{item.name}</h3>}</EventTooltip>
                    <span className="ib-board__count">{solvedCount(item.challenges)}</span>
                    <span className="ib-board__rest">{richMessage(tPlural("challenges.board.restPoints", restPoints(item.challenges)), {points: <span className="ib-num">{formatPoints(restPoints(item.challenges))}</span>})}</span>
                </header>
                <div className="ib-tiles">{item.visible.map(challenge => <ChallengeTile key={challenge.EventChallengeID} challenge={challenge} accepted={acceptedID === challenge.EventChallengeID} onOpen={onOpen} />)}</div>
            </section>)}
            {!shown.length && <Empty className="ib-board__state" query={query} emptyMessage={emptyMessage} onResetFilters={onResetFilters} onReset={() => { setQuery(""); search.current?.focus(); }} />}
        </div>
    </div>;
}

// «Рейка» — React port of ds-v2 IB.CategoryRail: one category per screen, keys 1–9, large tiles.
export function RailBoard({categories, acceptedID, onOpen, toolbar, category: picked, onCategory: setPicked, emptyMessage, onResetFilters}: BoardProps) {
    const [query, setQuery] = useState("");
    const search = useRef<HTMLInputElement>(null);
    useSlashSearch(search);
    const current = categories.find(item => item.key === picked) ?? categories[0];
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey || !/^[1-9]$/.test(event.key) || typing() || document.querySelector("dialog[open]")) return;
            const next = categories[Number(event.key) - 1];
            if (!next) return;
            event.preventDefault();
            setPicked(next.key);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [categories]);
    if (!current) return <div className="event-rail"><div className="event-rail__bar">{toolbar}</div><Empty className="ib-rail__state" query="" emptyMessage={emptyMessage} onResetFilters={onResetFilters} /></div>;
    const open = current.challenges.filter(item => !item.SolvedAt);
    const items = current.challenges.filter(item => matchesBoard(item, query));
    const searching = !!query.trim();
    return <div className="event-rail">
        <div className="event-rail__bar">
            {toolbar}
            <Search value={query} onChange={setQuery} inputRef={search} />
        </div>
        <div className="ib-rail">
            <nav className="ib-rail__nav" aria-label={t("challenges.board.categories")}>
                {categories.map((item, index) => {
                    const left = item.challenges.filter(challenge => !challenge.SolvedAt).length;
                    return <button key={item.key} type="button" className={`ib-rail__item${left === 0 ? " is-done" : ""}`} aria-current={item.key === current.key} aria-keyshortcuts={index < 9 ? String(index + 1) : undefined} onClick={() => setPicked(item.key)}>
                        <span className="ib-rail__key">{index < 9 ? index + 1 : ""}</span>
                        <span className="ib-rail__name"><b>{item.name}</b><small>{searching ? t("challenges.rail.found", {count: item.challenges.filter(challenge => matchesBoard(challenge, query)).length}) : left ? t("challenges.rail.left", {count: left}) : t("challenges.rail.allSolved")}</small></span>
                        <span className="ib-rail__count">{solvedCount(item.challenges)}</span>
                    </button>;
                })}
                <p className="ib-rail__hint">{richMessage(t("challenges.rail.hint"), {first: <kbd className="ib-kbd">1</kbd>, last: <kbd className="ib-kbd">{Math.min(9, categories.length)}</kbd>, br: <br />, slash: <kbd className="ib-kbd">/</kbd>})}</p>
            </nav>
            <div className="ib-rail__main">
                <header className="ib-rail__head">
                    <EventTooltip truncated placement="bottom" content={current.name}>{() => <h2>{current.name}</h2>}</EventTooltip>
                    <span className="ib-num">{solvedCount(current.challenges)}</span>
                    <span className="ib-rail__rest">{richMessage(tPlural("challenges.rail.rest", open.length), {points: <span className="ib-num">{formatPoints(restPoints(current.challenges))}</span>})}</span>
                </header>
                {items.length
                    ? <div className="ib-tiles ib-tiles--lg">{items.map(challenge => <ChallengeTile key={challenge.EventChallengeID} lg challenge={challenge} accepted={acceptedID === challenge.EventChallengeID} onOpen={onOpen} />)}</div>
                    : <Empty className="ib-rail__state" query={query} category={current.name} emptyMessage={emptyMessage} onResetFilters={onResetFilters} />}
            </div>
        </div>
    </div>;
}
