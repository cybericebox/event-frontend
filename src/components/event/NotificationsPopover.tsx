"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import DOMPurify from "isomorphic-dompurify";
import {Bell, X} from "lucide-react";
import toast from "react-hot-toast";
import {getInbox, markInboxAllRead, markInboxRead, pollInbox, type InboxCursor, type InboxItem} from "@/api/inbox";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {NotificationPopIn, popInDuration} from "./NotificationPopIn";
import {NotificationMessageCard} from "./NotificationMessageCard";
import {EventLoading} from "./EventLoading";

const readSyncKey = "cybericebox:inbox-read";
const zeroCursor = {ID: "00000000-0000-0000-0000-000000000000", CreatedAt: "1970-01-01T00:00:00Z"};

function safeHref(value: string): string | null {
    const href = value.trim();
    return (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#") || /^https?:\/\/|^mailto:/i.test(href) ? href : null;
}

function announceRead() {
    try {
        const previous = localStorage.getItem(readSyncKey);
        localStorage.setItem(readSyncKey, previous === "1" ? "0" : "1");
    } catch { /* Polling still synchronizes read state. */ }
}

export function NotificationsPopover() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<InboxItem[]>([]);
    const [popIns, setPopIns] = useState<InboxItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [older, setOlder] = useState<InboxCursor | null>(null);
    const [unread, setUnread] = useState(0);
    const [error, setError] = useState("");
    const cursor = useRef<InboxCursor | null>(null);
    const unreadRef = useRef(0);
    const olderRef = useRef<InboxCursor | null>(null);
    const loadingOlderRef = useRef(false);
    const revision = useRef(0);
    const openRef = useRef(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const lastRef = useRef<HTMLLIElement | null>(null);
    const lastID = items[items.length - 1]?.ID;

    const refresh = useCallback(async (): Promise<InboxItem[] | null> => {
        const current = ++revision.current;
        try {
            const page = await getInbox();
            if (current !== revision.current) return null;
            olderRef.current = page.NextCursor;
            setOlder(page.NextCursor);
            setItems(previous => page.Items.map(item => ({
                ...item, ReadAt: item.ReadAt ?? previous.find(old => old.ID === item.ID)?.ReadAt ?? null,
            })));
            const readByID = new Map(page.Items.map(item => [item.ID, item.ReadAt]));
            setPopIns(previous => previous.filter(item => !readByID.get(item.ID)));
            setError("");
            return page.Items;
        } catch {
            setError("Не вдалося завантажити вхідні повідомлення.");
            return null;
        } finally {
            if (current === revision.current) setLoading(false);
        }
    }, []);

    const loadOlder = useCallback(async () => {
        const before = olderRef.current;
        if (!before || loadingOlderRef.current) return;
        const current = revision.current;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        try {
            const page = await getInbox(before);
            if (current !== revision.current) return;
            olderRef.current = page.NextCursor;
            setOlder(page.NextCursor);
            setItems(previous => {
                const known = new Set(previous.map(item => item.ID));
                return [...previous, ...page.Items.filter(item => !known.has(item.ID))];
            });
            setError("");
        } catch {
            setError("Не вдалося завантажити старі повідомлення.");
        } finally {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    }, []);

    useEffect(() => {
        if (!open || !older || loading || !scrollRef.current || !lastRef.current || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(([entry]) => {if (entry.isIntersecting) void loadOlder();}, {root: scrollRef.current});
        observer.observe(lastRef.current);
        return () => observer.disconnect();
    }, [open, older, loading, lastID, loadOlder]);

    useEffect(() => {
        let active = true;
        let initialized = false;
        let busy = false;
        let pending = false;
        const poll = async () => {
            if (!active) return;
            if (busy) {pending = true; return;}
            busy = true;
            try {
                if (!initialized) {
                    const baseline = await pollInbox();
                    if (!active) return;
                    cursor.current = baseline.Cursor ?? zeroCursor;
                    unreadRef.current = baseline.UnreadCount;
                    setUnread(baseline.UnreadCount);
                    initialized = true;
                    await refresh();
                    return;
                }
                const result = await pollInbox(cursor.current ?? zeroCursor);
                if (!active) return;
                cursor.current = result.Cursor ?? cursor.current;
                const fresh = result.NewInbox.filter(item => !item.ReadAt);
                if (openRef.current && result.NewInbox.length) {
                    setItems(previous => {
                        const known = new Set(previous.map(item => item.ID));
                        return [...result.NewInbox.filter(item => !known.has(item.ID)).reverse(), ...previous];
                    });
                }
                let poppable = fresh.filter(item => popInDuration(item.AutoDismissMs) > 0);
                if (result.UnreadCount !== unreadRef.current + fresh.length) {
                    const latest = await refresh();
                    poppable = latest ? poppable.filter(item => latest.some(entry => entry.ID === item.ID && !entry.ReadAt)) : [];
                } else setError("");
                unreadRef.current = result.UnreadCount;
                setUnread(result.UnreadCount);
                if (poppable.length) setPopIns(previous => [...previous, ...poppable.filter(item => !previous.some(entry => entry.ID === item.ID))]);
            } catch {
                if (active) {setError("Не вдалося оновити вхідні повідомлення."); setLoading(false);}
            } finally {
                busy = false;
                if (pending && active) {pending = false; queueMicrotask(() => {void poll();});}
            }
        };
        const whenVisible = () => {if (document.visibilityState !== "hidden") void poll();};
        void poll();
        const timer = window.setInterval(whenVisible, 8_000);
        document.addEventListener("visibilitychange", whenVisible);
        window.addEventListener("focus", whenVisible);
        window.addEventListener("cybericebox:inbox-updated", whenVisible);
        const onStorage = (event: StorageEvent) => {if (event.key === readSyncKey) {whenVisible(); if (openRef.current) void refresh();}};
        window.addEventListener("storage", onStorage);
        return () => {
            active = false;
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", whenVisible);
            window.removeEventListener("focus", whenVisible);
            window.removeEventListener("cybericebox:inbox-updated", whenVisible);
            window.removeEventListener("storage", onStorage);
        };
    }, [refresh]);

    async function read(item: InboxItem): Promise<boolean> {
        if (item.ReadAt) return true;
        try {
            await markInboxRead(item.ID);
            unreadRef.current = Math.max(0, unreadRef.current - 1);
            setUnread(unreadRef.current);
            setItems(current => current.map(entry => entry.ID === item.ID ? {...entry, ReadAt: new Date().toISOString()} : entry));
            setPopIns(current => current.filter(entry => entry.ID !== item.ID));
            announceRead();
            return true;
        } catch {
            toast.error("Не вдалося позначити повідомлення прочитаним");
            return false;
        }
    }

    async function readAll() {
        try {
            await markInboxAllRead();
            unreadRef.current = 0;
            setUnread(0);
            setItems(current => current.map(item => ({...item, ReadAt: item.ReadAt ?? new Date().toISOString()})));
            setPopIns([]);
            announceRead();
            toast.success("Усі повідомлення прочитано");
        } catch {
            toast.error("Не вдалося позначити повідомлення прочитаними");
        }
    }

    async function follow(item: InboxItem, href: string) {
        if (!(await read(item))) return;
        const safe = safeHref(href);
        if (safe) {changeOpen(false); window.location.assign(safe);}
    }

    const label = unread ? "Вхідні: " + unread + " непрочитаних" : "Вхідні";
    const changeOpen = (next: boolean) => {
        openRef.current = next;
        setOpen(next);
        if (next) void refresh();
    };
    return <>
        <Popover open={open} onOpenChange={changeOpen}>
            <PopoverTrigger asChild><button className="event-navbar__icon event-notifications__trigger" type="button" aria-label={label} aria-expanded={open}>
                <Bell size={18} aria-hidden="true" />{unread > 0 && <span className="event-notifications__count">{unread > 99 ? "99+" : unread}</span>}
            </button></PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} collisionPadding={12} aria-label="Особисті вхідні" className="event-notifications__panel">
                <div className="event-notifications__head">
                    <h2><span className="event-notifications__sr-only">Вхідні</span><Bell size={19} aria-hidden="true" /></h2>
                    <div><button type="button" disabled={unread === 0} onClick={() => void readAll()}>Позначити все прочитаним</button><button className="event-notifications__icon-btn" type="button" aria-label="Закрити вхідні" onClick={() => changeOpen(false)}><X size={17} /></button></div>
                </div>
                {error && <p className="event-notifications__error" role="alert">{error}</p>}
                <div className="event-notifications__scroll" ref={scrollRef}>
                    {loading ? <EventLoading label="Завантаження повідомлень" /> : items.length === 0 ? <div className="event-notifications__empty" data-empty-state>
                        <span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4.5 5.5h15L21.5 18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2l2-12.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M3.5 14h4.7l1.5 2h4.6l1.5-2h4.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                        <p>Повідомлень поки немає.</p>
                    </div> : <ul className="event-notifications__list">{items.map((item, index) => {
                        const href = safeHref(item.Link);
                        return <li key={item.ID} ref={index === items.length - 1 ? lastRef : undefined}>
                            <NotificationMessageCard icon={item.Icon} tone={item.Tone} accentColor={item.AccentColor} title={item.Title}
                                body={item.Body ? <span dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(item.Body, {ALLOWED_TAGS: [], ALLOWED_ATTR: []})}} /> : undefined}
                                unread={!item.ReadAt} compact
                                timestamp={<time dateTime={item.CreatedAt}>{new Date(item.CreatedAt).toLocaleString("uk-UA")}</time>}
                                actions={href ? <a href={href} onClick={event => {event.preventDefault(); void follow(item, href);}}>Відкрити</a> : !item.ReadAt ? <button type="button" onClick={() => void read(item)}>Позначити прочитаним</button> : undefined}
                            />
                        </li>;
                    })}</ul>}
                    {loadingOlder && <p className="event-notifications__state">Завантажуємо старі повідомлення…</p>}
                </div>
            </PopoverContent>
        </Popover>
        {popIns.length > 0 && createPortal(<div className="event-notifications__popins" aria-live="polite">{popIns.slice(0, 3).map(item =>
            <NotificationPopIn key={item.ID} message={item} onClose={() => setPopIns(current => current.filter(entry => entry.ID !== item.ID))} onAction={href => {void follow(item, href);}} />
        )}</div>, document.body)}
    </>;
}
