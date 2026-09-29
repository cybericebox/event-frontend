"use client";

import {useEffect, useRef, useState, type RefObject} from "react";
import type {OwnChallenge} from "@/api/participantChallenges";
import {ChallengeTile} from "./ChallengeTile";
import {formatPoints, matchesBoard, pluralUk, restPoints, solvedCount, type BoardCategory, type BoardFilter} from "./challengeBoardModel";

type OpenHandler = (challenge: OwnChallenge, tile: HTMLButtonElement) => void;
type BoardProps = {categories: BoardCategory[]; acceptedID: string | null; onOpen: OpenHandler};

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

function FilterSeg({filter, onChange}: {filter: BoardFilter; onChange: (filter: BoardFilter) => void}) {
    return <div className="ib-seg" role="group" aria-label="Фільтр">
        {([["all", "Усі"], ["open", "Нерозвʼязані"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => onChange(value)}>{label}</button>)}
    </div>;
}

function Search({value, onChange, inputRef, className = ""}: {value: string; onChange: (value: string) => void; inputRef: RefObject<HTMLInputElement | null>; className?: string}) {
    return <label className={`ib-input-wrap ib-input-wrap--search ${className}`}>
        {SEARCH}
        <input ref={inputRef} className="ib-input" type="search" placeholder="Пошук завдання" aria-label="Пошук завдання" autoComplete="off" value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={event => { if (event.key === "Escape" && value) { event.stopPropagation(); onChange(""); } }} />
        <kbd className="ib-kbd" aria-hidden="true">/</kbd>
    </label>;
}

function Empty({query, className, category, onReset}: {query: string; className: string; category?: string; onReset?: () => void}) {
    const q = query.trim();
    return <div className={className}>
        <b>{q ? "Нічого не знайдено" : "Усе розвʼязано"}</b>
        {q ? `${category ? `У категорії ${category} за` : "За"} запитом «${q}» завдань немає.` : category ? "У цій категорії не лишилось відкритих завдань." : "У цьому виборі не лишилось відкритих завдань."}
        {q && onReset && <><br /><button type="button" className="ib-btn ib-btn--sm" onClick={onReset}>Скинути пошук</button></>}
    </div>;
}

// «Плитки» — React port of ds-v2 IB.ChallengeBoard: filter, category chips, search, sticky «4 / 10» headers.
export function TilesBoard({categories, acceptedID, onOpen}: BoardProps) {
    const [filter, setFilter] = useState<BoardFilter>("all");
    const [category, setCategory] = useState("");
    const [query, setQuery] = useState("");
    const search = useRef<HTMLInputElement>(null);
    useSlashSearch(search);
    const all = categories.flatMap(item => item.challenges);
    const shown = categories
        .filter(item => !category || item.key === category)
        .map(item => ({...item, visible: item.challenges.filter(challenge => matchesBoard(challenge, filter, query, item.name))}))
        .filter(item => item.visible.length > 0);
    return <div className="ib-board event-board">
        <div className="ib-board__bar">
            <FilterSeg filter={filter} onChange={setFilter} />
            <div className="ib-board__chips" role="group" aria-label="Категорія">
                <button type="button" className="ib-board__chip" aria-pressed={category === ""} onClick={() => setCategory("")}>Усі<span className="ib-num">{solvedCount(all)}</span></button>
                {categories.map(item => <button key={item.key} type="button" className="ib-board__chip" aria-pressed={category === item.key} onClick={() => setCategory(item.key)}>{item.name}<span className="ib-num">{solvedCount(item.challenges)}</span></button>)}
            </div>
            <Search value={query} onChange={setQuery} inputRef={search} className="ib-board__search" />
        </div>
        <div className="ib-board__body">
            {shown.map(item => <section key={item.key} className="ib-board__sec" aria-label={item.name}>
                <header className="ib-board__cat">
                    <h3>{item.name}</h3>
                    <span className="ib-board__count">{solvedCount(item.challenges)}</span>
                    <span className="ib-board__rest">лишилось <span className="ib-num">{formatPoints(restPoints(item.challenges))}</span> балів</span>
                </header>
                <div className="ib-tiles">{item.visible.map(challenge => <ChallengeTile key={challenge.EventChallengeID} challenge={challenge} accepted={acceptedID === challenge.EventChallengeID} onOpen={onOpen} />)}</div>
            </section>)}
            {!shown.length && <Empty className="ib-board__empty" query={query} onReset={() => { setQuery(""); search.current?.focus(); }} />}
        </div>
    </div>;
}

// «Рейка» — React port of ds-v2 IB.CategoryRail: one category per screen, keys 1–9, large tiles.
export function RailBoard({categories, acceptedID, onOpen}: BoardProps) {
    const [filter, setFilter] = useState<BoardFilter>("all");
    const [query, setQuery] = useState("");
    const [picked, setPicked] = useState("");
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
    if (!current) return null;
    const open = current.challenges.filter(item => !item.SolvedAt);
    const items = current.challenges.filter(item => matchesBoard(item, filter, query));
    const searching = !!query.trim();
    return <div className="event-rail">
        <div className="event-rail__bar">
            <FilterSeg filter={filter} onChange={setFilter} />
            <Search value={query} onChange={setQuery} inputRef={search} />
        </div>
        <div className="ib-rail">
            <nav className="ib-rail__nav" aria-label="Категорії">
                {categories.map((item, index) => {
                    const left = item.challenges.filter(challenge => !challenge.SolvedAt).length;
                    return <button key={item.key} type="button" className={`ib-rail__item${left === 0 ? " is-done" : ""}`} aria-current={item.key === current.key} aria-keyshortcuts={index < 9 ? String(index + 1) : undefined} onClick={() => setPicked(item.key)}>
                        <span className="ib-rail__key">{index < 9 ? index + 1 : ""}</span>
                        <span className="ib-rail__name"><b>{item.name}</b><small>{searching ? `знайдено ${item.challenges.filter(challenge => matchesBoard(challenge, filter, query)).length}` : left ? `лишилось ${left}` : "усе розвʼязано"}</small></span>
                        <span className="ib-rail__count">{solvedCount(item.challenges)}</span>
                    </button>;
                })}
                <p className="ib-rail__hint"><kbd className="ib-kbd">1</kbd>–<kbd className="ib-kbd">{Math.min(9, categories.length)}</kbd> категорія<br /><kbd className="ib-kbd">/</kbd> пошук</p>
            </nav>
            <div className="ib-rail__main">
                <header className="ib-rail__head">
                    <h2>{current.name}</h2>
                    <span className="ib-num">{solvedCount(current.challenges)}</span>
                    <span className="ib-rail__rest">Лишилось {open.length} {pluralUk(open.length, "завдання", "завдання", "завдань")} · <span className="ib-num">{formatPoints(restPoints(current.challenges))}</span> балів</span>
                </header>
                {items.length
                    ? <div className="ib-tiles ib-tiles--lg">{items.map(challenge => <ChallengeTile key={challenge.EventChallengeID} lg challenge={challenge} accepted={acceptedID === challenge.EventChallengeID} onOpen={onOpen} />)}</div>
                    : <Empty className="ib-rail__empty" query={query} category={current.name} />}
            </div>
        </div>
    </div>;
}
