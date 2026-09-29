"use client";

// Categorized inbox (docs/INBOX-DESIGN.md §3, §8): a one-to-one copy of main-frontend's
// components/site/InboxButton.tsx; only imports and styling (public/event-inbox-v2.css) differ.

import {useCallback, useEffect, useRef, useState} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {createPortal} from "react-dom";
import DOMPurify from "isomorphic-dompurify";
import {Bell, Check, ChevronRight, X} from "lucide-react";
import {EmptyState} from "@/components/ui/EmptyState";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {getInbox, markInboxAllRead, markInboxRead, pollInbox, resolveInboxRequest, InboxError, type InboxCursor} from "@/api/inbox";
import {apiErrorMessage} from "@/i18n/apiError";
import {t} from "@/i18n/t";
import {EventLoading} from "./EventLoading";
import {NotificationMessageCard} from "./NotificationMessageCard";
import {NotificationPopIn, popInDuration} from "./NotificationPopIn";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {
    INBOX_TABS, canResolve, countsAfterRead, countsAfterReadAll, countsAfterResolve, formatInboxTime, inTab, inboxQuery, isUnread, orderForTab,
    bellCount, parseCounts, parseOtherEvents, resolutionKey, resolveDefaultTab, resolverName,
    type InboxCounts, type InboxDefaultTab, type InboxMessage as Message, type InboxTab,
} from "./inboxModel";

const READ_SYNC_KEY = "cybericebox:inbox-read";
// A link here with ?inbox opens the dropdown on arrival (the event site's «Ще N в інших заходах»).
const OPEN_PARAM = "inbox";
const zeroCursor: InboxCursor = {ID: "00000000-0000-0000-0000-000000000000", CreatedAt: "1970-01-01T00:00:00Z"};

export type InboxButtonProps = {
    /** Tab shown on every open: landing "all", id "personal", admin/exercises "requestsIfOpen", event "all" (/manage: "requests"). */
    defaultTab?: InboxDefaultTab;
    /** Event-site mode: the list is scoped to this event, event labels are hidden, and other events' unread show as a footer link. */
    event?: {id: string; otherEventsHref: string};
};

function EventLabel({name}: {name?: string | null}) {
    if (!name) return null;
    return <span className="event-notifications__event">{name}</span>;
}

function safeHref(value: string): string | null {
    const href = value.trim();
    if (href.startsWith("/") && !href.startsWith("//")) return href;
    if (href.startsWith("#") || /^https?:\/\/|^mailto:/i.test(href)) return href;
    return null;
}

function resolvedLine(item: Message): string {
    const name = resolverName(item);
    return t(resolutionKey(item.Resolution, name !== ""), {name, time: formatInboxTime(item.ResolvedAt ?? "")});
}

export function InboxButton({defaultTab = "all", event}: InboxButtonProps = {}) {
    const eventId = event?.id;
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<InboxTab>("all");
    const [items, setItems] = useState<Message[]>([]);
    const [popIns, setPopIns] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [olderCursor, setOlderCursor] = useState<InboxCursor | null>(null);
    const [unread, setUnread] = useState(0);
    // null = the backend has no categories yet: the dropdown shows only «Усі».
    const [counts, setCounts] = useState<InboxCounts | null>(null);
    const [otherEvents, setOtherEvents] = useState(0);
    const [error, setError] = useState("");
    const [resolving, setResolving] = useState<string | null>(null);
    const cursorRef = useRef<InboxCursor | null>(null);
    const unreadCountRef = useRef(0);
    const countsRef = useRef<InboxCounts | null>(null);
    const tabRef = useRef<InboxTab>("all");
    const olderCursorRef = useRef<InboxCursor | null>(null);
    const loadingOlderRef = useRef(false);
    const listRevisionRef = useRef(0);
    const openRef = useRef(false);
    const pollNowRef = useRef<() => void>(() => {});
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    const lastItemRef = useRef<HTMLLIElement | null>(null);
    const lastItemID = items[items.length - 1]?.ID;

    const applyCounts = useCallback((next: InboxCounts | null) => {
        countsRef.current = next;
        setCounts(next);
    }, []);

    const loadOlder = useCallback(async () => {
        const before = olderCursorRef.current;
        if (!before || loadingOlderRef.current) return;
        const revision = listRevisionRef.current;
        const current = tabRef.current;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        try {
            const page = await getInbox(inboxQuery(current, eventId, {before_id: before.ID, before_at: before.CreatedAt}));
            if (revision !== listRevisionRef.current) return;
            olderCursorRef.current = page.NextCursor;
            setOlderCursor(page.NextCursor);
            setItems(previous => {
                const known = new Set(previous.map(item => item.ID));
                return orderForTab([...previous, ...page.Items.filter(item => !known.has(item.ID))], current);
            });
            setError("");
        } catch { setError(t("inbox.loadError")); }
        finally { loadingOlderRef.current = false; setLoadingOlder(false); }
    }, [eventId]);

    useEffect(() => {
        const area = scrollAreaRef.current;
        const last = lastItemRef.current;
        if (!open || !olderCursor || loading || !area || !last || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) void loadOlder();
        }, {root: area});
        observer.observe(last);
        return () => observer.disconnect();
    }, [open, olderCursor, lastItemID, loading, loadOlder]);

    const refresh = useCallback((): Promise<Message[] | null> => {
        const revision = ++listRevisionRef.current;
        const current = tabRef.current;
        return getInbox(inboxQuery(current, eventId))
            .then(page => {
                if (revision !== listRevisionRef.current) return null;
                const list = page.Items;
                olderCursorRef.current = page.NextCursor;
                setOlderCursor(page.NextCursor);
                // An older refresh must not undo a successful read action.
                setItems(previous => orderForTab(list.map(item => ({
                    ...item,
                    ReadAt: item.ReadAt ?? previous.find(entry => entry.ID === item.ID)?.ReadAt ?? null,
                })), current));
                const readById = new Map(list.map(item => [item.ID, !isUnread(item)]));
                setPopIns(previous => previous.filter(item => !readById.get(item.ID)));
                setError("");
                return list;
            })
            .catch(() => { setError(t("inbox.loadError")); return null; })
            .finally(() => { if (revision === listRevisionRef.current) setLoading(false); });
    }, [eventId]);

    useEffect(() => {
        let active = true;
        let initialized = false;
        let polling = false;
        let pending = false;
        const scope = eventId ? {event: eventId} : undefined;
        const poll = async () => {
            if (!active) return;
            if (polling) { pending = true; return; }
            polling = true;
            try {
                if (!initialized) {
                    const baseline = await pollInbox(inboxQuery("all", undefined, scope));
                    if (!active) return;
                    cursorRef.current = baseline.Cursor ?? zeroCursor;
                    unreadCountRef.current = baseline.UnreadCount;
                    setUnread(baseline.UnreadCount);
                    applyCounts(parseCounts(baseline.Counts));
                    setOtherEvents(parseOtherEvents(baseline.OtherEventsCount));
                    initialized = true;
                    await refresh();
                    return;
                }
                const since = cursorRef.current ?? zeroCursor;
                const result = await pollInbox(inboxQuery("all", undefined, {...scope, since_id: since.ID, since_at: since.CreatedAt}));
                if (!active) return;
                cursorRef.current = result.Cursor ?? since;
                const fresh = result.NewInbox.filter(isUnread);
                if (openRef.current && result.NewInbox.length) {
                    const current = tabRef.current;
                    setItems(previous => {
                        const known = new Set(previous.map(item => item.ID));
                        const added = result.NewInbox.filter(item => !known.has(item.ID) && inTab(item, current)).reverse();
                        return added.length ? orderForTab([...added, ...previous], current) : previous;
                    });
                }
                let poppable = fresh.filter(item => popInDuration(item.AutoDismissMs) > 0);
                if (result.UnreadCount !== unreadCountRef.current + fresh.length) {
                    const latest = await refresh();
                    poppable = latest ? poppable.filter(item => latest.some(entry => entry.ID === item.ID && isUnread(entry))) : [];
                } else {
                    setError("");
                }
                unreadCountRef.current = result.UnreadCount;
                setUnread(result.UnreadCount);
                // Older backends send no Counts: keep the last known ones.
                const nextCounts = parseCounts(result.Counts);
                if (nextCounts) applyCounts(nextCounts);
                if (result.OtherEventsCount !== undefined) setOtherEvents(parseOtherEvents(result.OtherEventsCount));
                if (active && poppable.length) setPopIns(previous => [...previous, ...poppable.filter(item => !previous.some(entry => entry.ID === item.ID))]);
            } catch {
                if (active) { setError(t("inbox.loadError")); setLoading(false); }
            } finally {
                polling = false;
                if (pending && active) { pending = false; queueMicrotask(() => { void poll(); }); }
            }
        };
        const pollWhenVisible = () => { if (document.visibilityState !== "hidden") void poll(); };
        pollNowRef.current = () => { void poll(); };
        void poll();
        const timer = window.setInterval(pollWhenVisible, 8_000);
        document.addEventListener("visibilitychange", pollWhenVisible);
        window.addEventListener("focus", pollWhenVisible);
        window.addEventListener("cybericebox:inbox-updated", pollWhenVisible);
        const onStorage = (storageEvent: StorageEvent) => { if (storageEvent.key === READ_SYNC_KEY) { pollWhenVisible(); if (openRef.current) void refresh(); } };
        window.addEventListener("storage", onStorage);
        return () => {
            active = false;
            pollNowRef.current = () => {};
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", pollWhenVisible);
            window.removeEventListener("focus", pollWhenVisible);
            window.removeEventListener("cybericebox:inbox-updated", pollWhenVisible);
            window.removeEventListener("storage", onStorage);
        };
    }, [refresh, applyCounts, eventId]);

    const selectTab = useCallback((next: InboxTab) => {
        tabRef.current = next;
        setTab(next);
        setItems([]);
        setOlderCursor(null);
        olderCursorRef.current = null;
        setLoading(true);
        scrollAreaRef.current?.scrollTo({top: 0});
        void refresh();
    }, [refresh]);

    const openInbox = useCallback((next: boolean) => {
        openRef.current = next;
        setOpen(next);
        // The chosen tab lives while the dropdown is open; every open starts on the app's default.
        if (!next) return;
        const initial = resolveDefaultTab(defaultTab, countsRef.current);
        if (initial === tabRef.current) void refresh();
        else selectTab(initial);
    }, [defaultTab, selectTab, refresh]);

    useEffect(() => {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(OPEN_PARAM)) return;
        // After mount, not during the effect (react-hooks/set-state-in-effect).
        const timer = window.setTimeout(() => {
            url.searchParams.delete(OPEN_PARAM);
            window.history.replaceState(window.history.state, "", url);
            openInbox(true);
        });
        return () => window.clearTimeout(timer);
    }, [openInbox]);

    const badge = bellCount(unread, counts);
    const label = badge ? t("inbox.titleUnread", {count: badge}) : t("inbox.title");
    const tabs = counts ? INBOX_TABS : [];
    const tabHasUnread = items.some(isUnread) || (tab === "all" ? unread > 0 : tab !== "requests" && (counts?.[tab] ?? 0) > 0);

    function announceRead() {
        try {
            const previous = window.localStorage.getItem(READ_SYNC_KEY);
            window.localStorage.setItem(READ_SYNC_KEY, previous === "1" ? "0" : "1");
        } catch { /* Polling still synchronizes read state. */ }
    }

    async function markRead(item: Message): Promise<boolean> {
        if (!isUnread(item)) return true;
        try {
            await markInboxRead(item.ID);
            unreadCountRef.current = Math.max(0, unreadCountRef.current - 1);
            setUnread(unreadCountRef.current);
            if (countsRef.current) applyCounts(countsAfterRead(countsRef.current, item));
            setItems(current => current.map(entry => entry.ID === item.ID ? {...entry, ReadAt: new Date().toISOString()} : entry));
            setPopIns(current => current.filter(entry => entry.ID !== item.ID));
            announceRead();
            return true;
        } catch {
            setError(t("inbox.readError"));
            return false;
        }
    }

    async function followLink(item: Message, href: string) {
        if (!(await markRead(item))) return;
        openInbox(false);
        window.location.assign(href);
    }

    // «Вирішено» closes a «Лабораторія впала» request for every recipient (§8.2).
    async function resolve(item: Message) {
        setError("");
        setResolving(item.ID);
        let failure = "";
        try {
            await resolveInboxRequest(item.ID);
            if (countsRef.current) applyCounts(countsAfterResolve(countsRef.current, item));
            if (isUnread(item)) {
                unreadCountRef.current = Math.max(0, unreadCountRef.current - 1);
                setUnread(unreadCountRef.current);
            }
            announceRead();
        } catch (err) {
            // 30217 not found, 20218 not resolvable by hand, 70219 already resolved: show why, then the current state.
            failure = apiErrorMessage(err instanceof InboxError ? err.code : undefined);
        }
        setResolving(null);
        await refresh();
        if (failure) setError(failure);
        else pollNowRef.current();
    }

    // «Позначити прочитаним» acts on the current tab only.
    async function readAll() {
        setError("");
        const current = tab;
        try {
            await markInboxAllRead(inboxQuery(current, eventId));
            const now = new Date().toISOString();
            if (current === "all") {
                unreadCountRef.current = 0;
                setUnread(0);
                setPopIns([]);
            }
            if (countsRef.current) applyCounts(countsAfterReadAll(countsRef.current, current));
            setItems(list => list.map(item => inTab(item, current) ? {...item, ReadAt: item.ReadAt ?? now} : item));
            announceRead();
            // Category totals come from the server; the poll corrects the bell right away.
            if (current !== "all") pollNowRef.current();
        } catch {
            setError(t("inbox.readError"));
        }
    }

    const emptyMessage = tab === "requests" ? t("inbox.emptyRequests") : t("inbox.empty");

    return <>
        <Popover open={open} onOpenChange={openInbox}>
            <PopoverTrigger asChild>
                <button type="button" aria-label={label} className="event-navbar__icon event-notifications__trigger">
                    <Bell size={18} aria-hidden="true" />
                    {badge > 0 && <span className="event-notifications__count">{badge > 99 ? "99+" : badge}</span>}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={20} collisionPadding={12} aria-label={t("inbox.title")} className="event-notifications__panel">
                <div className="event-notifications__head">
                    <h2><span className="event-notifications__sr-only">{t("inbox.title")}</span><Bell size={20} aria-hidden="true" /></h2>
                    <div>
                        <button type="button" disabled={!tabHasUnread} onClick={() => void readAll()}>{t("inbox.readAll")}</button>
                        <button className="event-notifications__icon-btn" type="button" aria-label={t("inbox.close")} onClick={() => openInbox(false)}><X size={16} /></button>
                    </div>
                </div>
                {/* The segmented control of the catalog's «Область» switch (exercises-frontend). */}
                {tabs.length > 0 && <div className="event-notifications__tabs-wrap">
                    <div role="tablist" aria-label={t("inbox.tabs")} className="event-notifications__tabs">
                        {tabs.map(value => {
                            const count = counts?.[value] ?? 0;
                            const selected = tab === value;
                            return <button key={value} type="button" role="tab" id={`inbox-tab-${value}`} aria-controls="inbox-tabpanel" aria-selected={selected}
                                aria-label={count > 0 ? t("inbox.tabCount", {name: t(`inbox.tab.${value}`), count}) : undefined}
                                onClick={() => { if (!selected) selectTab(value); }}>
                                <span className="event-notifications__tab-name">{t(`inbox.tab.${value}`)}</span>
                                {count > 0 && <span aria-hidden="true" className="event-notifications__tab-count">{count > 99 ? "99+" : count}</span>}
                            </button>;
                        })}
                    </div>
                </div>}
                {error && items.length > 0 && <p role="alert" className="event-notifications__error">{error}</p>}
                <div ref={scrollAreaRef} id="inbox-tabpanel" role={tabs.length ? "tabpanel" : undefined} aria-labelledby={tabs.length ? `inbox-tab-${tab}` : undefined} className="event-notifications__scroll">
                    {/* loading and empty share one centered box of the same height, so nothing jumps */}
                    {loading ? <EventLoading compact label={t("common.loading")} /> : items.length === 0 ? error ? <EventLoadError compact message={error} onRetry={() => { void refresh() }} /> : <EmptyState compact message={emptyMessage} /> : <ul className="event-notifications__list">{items.map((item, index) => {
                        const href = safeHref(item.Link ?? "");
                        const resolved = !!item.ResolvedAt;
                        const unreadItem = isUnread(item);
                        return <li key={item.ID} ref={index === items.length - 1 ? lastItemRef : undefined} className={resolved ? "is-resolved" : undefined}>
                            <NotificationMessageCard
                                icon={item.Icon} tone={item.Tone} accentColor={item.AccentColor} title={item.Title}
                                body={item.Body ? <span dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(item.Body, {ALLOWED_TAGS: [], ALLOWED_ATTR: []})}} /> : undefined}
                                unread={unreadItem} compact
                                timestamp={<span className="event-notifications__meta">
                                    {resolved
                                        ? <EventTooltip content={formatInboxTime(item.CreatedAt)}>{id => <span aria-describedby={id}>{resolvedLine(item)}</span>}</EventTooltip>
                                        : <time dateTime={item.CreatedAt}>{formatInboxTime(item.CreatedAt)}</time>}
                                    {!event && <EventLabel name={item.EventName} />}
                                </span>}
                                actions={href || unreadItem || canResolve(item) ? <>
                                    {href ? <a href={href} onClick={clickEvent => { clickEvent.preventDefault(); void followLink(item, href); }}>{t("inbox.open")}</a> : unreadItem ? <button type="button" onClick={() => void markRead(item)}>{t("inbox.markRead")}</button> : null}
                                    {canResolve(item) && <button type="button" className="event-notifications__resolve" disabled={resolving !== null} aria-busy={resolving === item.ID} onClick={() => void resolve(item)}>
                                        {resolving === item.ID ? <EventLoading compact label={t("common.loading")} /> : <Check size={14} aria-hidden="true" />}{t("inbox.resolve")}
                                    </button>}
                                </> : undefined}
                            />
                        </li>;
                    })}</ul>}
                    {loadingOlder && <div className="event-notifications__older"><EventLoading compact label={t("common.loading")} /></div>}
                </div>
                {event && otherEvents > 0 && <a href={event.otherEventsHref} className="event-notifications__other">
                    {t("inbox.otherEvents", {count: otherEvents})}<ChevronRight size={16} aria-hidden="true" />
                </a>}
            </PopoverContent>
        </Popover>
        {popIns.length > 0 && createPortal(<div className="event-notifications__popins" aria-live="polite">
            {popIns.slice(0, 3).map(item => <NotificationPopIn key={item.ID} message={item} onClose={() => setPopIns(current => current.filter(entry => entry.ID !== item.ID))} onAction={href => { const safe = safeHref(href); if (safe) void followLink(item, safe); }} />)}
        </div>, document.body)}
    </>;
}
