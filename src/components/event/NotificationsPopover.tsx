"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import DOMPurify from "isomorphic-dompurify";
import {Bell, BellOff, ChevronLeft, X} from "lucide-react";
import toast from "react-hot-toast";
import {getInbox, markInboxAllRead, markInboxRead, pollInbox, type InboxCursor, type InboxItem} from "@/api/inbox";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {NotificationPopIn, popInDuration} from "./NotificationPopIn";

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
    const [selected, setSelected] = useState<string | null>(null);
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
        if (!open || selected || !older || loading || !scrollRef.current || !lastRef.current || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(([entry]) => {if (entry.isIntersecting) void loadOlder();}, {root: scrollRef.current});
        observer.observe(lastRef.current);
        return () => observer.disconnect();
    }, [open, selected, older, loading, lastID, loadOlder]);

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
        const onStorage = (event: StorageEvent) => {if (event.key === readSyncKey) {whenVisible(); if (openRef.current) void refresh();}};
        window.addEventListener("storage", onStorage);
        return () => {
            active = false;
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", whenVisible);
            window.removeEventListener("focus", whenVisible);
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
        if (safe) window.location.assign(safe);
    }

    const active = items.find(item => item.ID === selected);
    const label = unread ? "Вхідні: " + unread + " непрочитаних" : "Вхідні";
    const changeOpen = (next: boolean) => {
        openRef.current = next;
        setOpen(next);
        if (next) void refresh();
        else setSelected(null);
    };
    return <>
        <Popover open={open} onOpenChange={changeOpen}>
            <PopoverTrigger asChild><button className="event-navbar__icon event-notifications__trigger" type="button" aria-label={label} aria-expanded={open}>
                <Bell size={18} aria-hidden="true" />{unread > 0 && <span className="event-notifications__count">{unread > 99 ? "99+" : unread}</span>}
            </button></PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} collisionPadding={12} aria-label="Вхідні" className="event-notifications__panel">
                <div className="event-notifications__head">
                    <div>{active && <button className="event-notifications__icon-btn" type="button" aria-label="Назад до списку" onClick={() => setSelected(null)}><ChevronLeft size={17} /></button>}<strong>{active?.Title ?? "Вхідні"}</strong></div>
                    <div>{!active && unread > 0 && <button type="button" onClick={() => void readAll()}>Прочитати всі</button>}<button className="event-notifications__icon-btn" type="button" aria-label="Закрити вхідні" onClick={() => changeOpen(false)}><X size={17} /></button></div>
                </div>
                {error && <p className="event-notifications__error" role="alert">{error}</p>}
                {active ? <section className="event-notifications__detail" aria-label="Повідомлення">
                    <time dateTime={active.CreatedAt}>{new Date(active.CreatedAt).toLocaleString("uk-UA")}</time>
                    <div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(active.Body)}} />
                    {safeHref(active.Link) && <a href={safeHref(active.Link)!} onClick={event => {event.preventDefault(); void follow(active, active.Link);}}>Відкрити</a>}
                </section> : <div className="event-notifications__scroll" ref={scrollRef}>
                    {loading ? <p className="event-notifications__state">Завантажуємо повідомлення…</p> : items.length === 0 ? <div className="event-notifications__state"><BellOff size={22} /><span>Повідомлень поки немає</span></div> :
                    <ul className="event-notifications__list">{items.map((item, index) => <li key={item.ID} ref={index === items.length - 1 ? lastRef : undefined}>
                        <button type="button" className={item.ReadAt ? "" : "is-unread"} onClick={() => {setSelected(item.ID); void read(item);}}>
                            <span>{item.Title}{!item.ReadAt && <i aria-label="Непрочитане" />}</span>
                            <time dateTime={item.CreatedAt}>{new Date(item.CreatedAt).toLocaleString("uk-UA")}</time>
                        </button>
                    </li>)}</ul>}
                    {loadingOlder && <p className="event-notifications__state">Завантажуємо старі повідомлення…</p>}
                </div>}
            </PopoverContent>
        </Popover>
        {popIns.length > 0 && createPortal(<div className="event-notifications__popins" aria-live="polite">{popIns.slice(0, 3).map(item =>
            <NotificationPopIn key={item.ID} message={item} onClose={() => setPopIns(current => current.filter(entry => entry.ID !== item.ID))} onAction={href => {void follow(item, href);}} />
        )}</div>, document.body)}
    </>;
}
