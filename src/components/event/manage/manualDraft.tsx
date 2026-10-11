"use client";

import {createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction} from "react";
import {usePathname, useRouter} from "next/navigation";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {t} from "@/i18n/t";
import {manualDraftKey, manualDraftPagePrefix, STORAGE_MANUAL_DRAFT_PREFIX} from "@/utils/storageKeys";

type Registration = {dirty: boolean; changed: boolean; reset: () => void};
type DraftContextValue = {userID: string; eventID: string; pathname: string; register: (key: string, value: Registration) => void; unregister: (key: string) => void; setDirty: (keys: string[], dirty: boolean | undefined, preserveInput?: boolean) => void; navigate: (action: () => void) => void};
const DraftContext = createContext<DraftContextValue | null>(null);
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function removeMatching(prefix: string) {
    try {
        for (const key of Object.keys(window.sessionStorage)) if (key.startsWith(prefix)) window.sessionStorage.removeItem(key);
    } catch { /* Blocked storage keeps the in-memory draft usable. */ }
}

export function clearManualDrafts() {if (typeof window !== "undefined") removeMatching(STORAGE_MANUAL_DRAFT_PREFIX);}

function read<T>(key: string | null, initial: T): T {
    if (!key || typeof window === "undefined") return initial;
    try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) return initial;
        const envelope = JSON.parse(raw);
        return envelope.version === 1 && "value" in envelope ? envelope.value as T : initial;
    } catch {return initial;}
}

function write(key: string | null, value: unknown, initial: unknown, dirty = true) {
    if (!key || typeof window === "undefined") return;
    try {
        if (same(value, initial)) window.sessionStorage.removeItem(key);
        else window.sessionStorage.setItem(key, JSON.stringify({version: 1, value, dirty}));
    } catch { /* A full or blocked store still leaves the draft in memory. */ }
}

function changesPage(href: string) {
    const next = new URL(href, window.location.href);
    return next.origin !== window.location.origin || next.pathname !== window.location.pathname || next.search !== window.location.search;
}

// The hook stores only serializable form state. Callers retain server data as
// their fallback, and reset their edit state only after that save succeeds.
export function useSessionDraftState<T>(slot: string, initial: T | (() => T), options?: {serialize?: (value: T) => T; dirty?: (value: T) => boolean | undefined; reconcile?: boolean | "storage"}): [T, Dispatch<SetStateAction<T>>] {
    const context = useContext(DraftContext);
    const [initialValue] = useState<T>(() => typeof initial === "function" ? (initial as () => T)() : initial);
    const key = context?.userID ? manualDraftKey(context.userID, context.eventID, context.pathname, slot) : null;
    const restored = useMemo(() => read(key, initialValue), [key, initialValue]);
    const [state, setState] = useState({key, value: restored});
    const value = state.key === key ? state.value : restored;
    const latest = useRef({key, value});
    const latestOptions = useRef(options);
    useLayoutEffect(() => {latest.current = {key, value}; latestOptions.current = options;}, [key, value, options]);
    const assessed = options?.dirty?.(value);
    const changed = !same(value, initialValue);
    const dirty = assessed ?? changed;
    const register = context?.register;
    const unregister = context?.unregister;
    const reset = useCallback(() => {if (latest.current.key !== key) return; latest.current = {key, value: initialValue}; setState({key, value: initialValue}); write(key, initialValue, initialValue);}, [key, initialValue]);
    useLayoutEffect(() => {
        if (!key || !register) return;
        register(key, {dirty, changed, reset});
        if (options?.reconcile && assessed === false && changed) {write(key, initialValue, initialValue); if (options.reconcile === true) reset();}
        return () => unregister?.(key);
    }, [key, register, unregister, dirty, changed, assessed, options?.reconcile, initialValue, reset]);
    const setValue: Dispatch<SetStateAction<T>> = useCallback(update => {
        if (latest.current.key !== key) return;
        const next = typeof update === "function" ? (update as (previous: T) => T)(latest.current.value) : update;
        latest.current = {key, value: next};
        const settings = latestOptions.current;
        const stored = settings?.serialize ? settings.serialize(next) : next;
        const changed = !same(next, initialValue);
        const dirty = settings?.dirty?.(next) ?? changed;
        write(key, stored, initialValue, dirty);
        if (key && register) register(key, {dirty, changed, reset});
        setState({key, value: next});
    }, [key, initialValue, register, reset]);
    return [value, setValue];
}

// Use the form's existing server comparison, including edits reverted by the user.
export function useDraftDirty(slot: string | string[], dirty: boolean | undefined, options?: {preserveInput?: boolean}) {
    const context = useContext(DraftContext);
    useLayoutEffect(() => {
        if (!context?.userID) return;
        const names: string[] = typeof slot === "string" ? [slot] : slot;
        context.setDirty(names.map(name => manualDraftKey(context.userID, context.eventID, context.pathname, name)), dirty, options?.preserveInput);
    });
}

export function useDraftNavigation() {
    const context = useContext(DraftContext);
    return context?.navigate ?? ((action: () => void) => action());
}

export function useDraftRouter() {
    const router = useRouter();
    const navigate = useDraftNavigation();
    return useMemo(() => ({...router,
        push: (...args: Parameters<typeof router.push>) => {if (changesPage(args[0])) navigate(() => router.push(...args)); else router.push(...args);},
        replace: (...args: Parameters<typeof router.replace>) => {if (changesPage(args[0])) navigate(() => router.replace(...args)); else router.replace(...args);},
    }), [router, navigate]);
}

export function ManualDraftProvider({userID, eventID, children}: {userID: string; eventID: string; children: ReactNode}) {
    const pathname = usePathname();
    const router = useRouter();
    const routes = useRef(router);
    useLayoutEffect(() => {routes.current = router;}, [router]);
    const entries = useRef(new Map<string, Registration>());
    const [pending, setPending] = useState<(() => void) | null>(null);
    const prefix = manualDraftPagePrefix(userID, eventID, pathname);
    const dirty = useCallback(() => {
        if (Array.from(entries.current.entries()).some(([key, value]) => key.startsWith(prefix) && value.dirty)) return true;
        try {return Object.keys(window.sessionStorage).some(key => {if (entries.current.has(key) || !key.startsWith(prefix)) return false; try {return JSON.parse(window.sessionStorage.getItem(key) ?? "null")?.dirty === true;} catch {return false;}});} catch {return false;}
    }, [prefix]);
    const register = useCallback((key: string, value: Registration) => {entries.current.set(key, value);}, []);
    const unregister = useCallback((key: string) => {entries.current.delete(key);}, []);
    const clearPage = useCallback(() => {
        for (const [key, value] of entries.current) if (key.startsWith(prefix)) {entries.current.delete(key); value.reset();}
        removeMatching(prefix);
    }, [prefix]);
    const setDirty = useCallback((keys: string[], dirty: boolean | undefined, preserveInput = false) => {
        if (dirty === undefined) return;
        for (const key of keys) {
            const registered = entries.current.get(key);
            if (registered) {
                entries.current.set(key, {...registered, dirty, changed: registered.changed});
                if (!dirty && registered.changed && !preserveInput) {registered.reset(); continue;}
            }
            try {
                if (!dirty) {window.sessionStorage.removeItem(key); continue;}
                const raw = window.sessionStorage.getItem(key);
                if (raw) window.sessionStorage.setItem(key, JSON.stringify({...JSON.parse(raw), dirty}));
            } catch { /* Storage is optional. */ }
        }
    }, []);
    const navigate = useCallback((action: () => void) => {if (dirty()) setPending(() => action); else {clearPage(); action();}}, [dirty, clearPage]);
    const context = useMemo(() => ({userID, eventID, pathname, register, unregister, setDirty, navigate}), [userID, eventID, pathname, register, unregister, setDirty, navigate]);

    // Closing/reloading the document and cross-document browser history cannot
    // use the app dialog. The browser supplies its warning; edits are already
    // synchronously persisted, including when the user proceeds with a reload.
    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (!dirty()) return;
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [dirty]);

    useEffect(() => {
        const click = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
            if (!anchor || anchor.hasAttribute("data-manual-draft-navigation") || anchor.hasAttribute("download") || anchor.target && anchor.target !== "_self" || !/^https?:$/.test(anchor.protocol) || !changesPage(anchor.href)) return;
            if (!dirty()) {clearPage(); return;}
            event.preventDefault(); event.stopPropagation();
            const url = new URL(anchor.href);
            navigate(() => {if (url.origin === window.location.origin) routes.current.push(`${url.pathname}${url.search}${url.hash}`); else window.location.assign(url.href);});
        };
        document.addEventListener("click", click, true);
        return () => document.removeEventListener("click", click, true);
    }, [dirty, navigate, clearPage]);

    // Native indices cover history made before this app mounted. The marker
    // fallback covers app-created entries in older browsers without adding entries.
    useEffect(() => {
        const history = window.history;
        const push = history.pushState;
        const replace = history.replaceState;
        const nativeIndex = () => {
            const value = (window as Window & {navigation?: {currentEntry?: {index: number} | null}}).navigation?.currentEntry?.index;
            return typeof value === "number" && value >= 0 ? value : undefined;
        };
        let epoch = history.state?.cibDraftEpoch ?? crypto.randomUUID();
        let index = nativeIndex() ?? (typeof history.state?.cibDraftIndex === "number" ? history.state.cibDraftIndex : 0);
        let currentURL = window.location.href;
        let currentState = {...history.state, cibDraftIndex: index, cibDraftEpoch: epoch};
        replace.call(history, currentState, "");
        const trackedPush: History["pushState"] = function (this: History, data, title, url) {
            index++; currentURL = new URL(String(url ?? window.location.href), window.location.href).href;
            currentState = {...data, cibDraftIndex: index, cibDraftEpoch: epoch};
            return push.call(this, currentState, title, url);
        };
        const trackedReplace: History["replaceState"] = function (this: History, data, title, url) {
            currentURL = new URL(String(url ?? window.location.href), window.location.href).href;
            currentState = {...data, cibDraftIndex: index, cibDraftEpoch: epoch};
            return replace.call(this, currentState, title, url);
        };
        history.pushState = trackedPush; history.replaceState = trackedReplace;
        let restoring = false;
        let allow = false;
        let afterRestore: (() => void) | null = null;
        const pop = (event: PopStateEvent) => {
            const marker = event.state?.cibDraftEpoch === epoch && typeof event.state?.cibDraftIndex === "number" ? event.state.cibDraftIndex : undefined;
            const next: number | undefined = nativeIndex() ?? marker;
            if (restoring) {
                event.stopImmediatePropagation();
                if (next === index) {restoring = false; const resume = afterRestore; afterRestore = null; if (resume) queueMicrotask(resume);}
                return;
            }
            const previous = new URL(currentURL);
            const target = new URL(window.location.href);
            const samePage = previous.pathname === target.pathname && previous.search === target.search;
            if (allow || samePage || !dirty()) {
                allow = false; if (!samePage) clearPage();
                // Unknown legacy traversal begins a new marker generation;
                // its direction cannot safely be inferred from History state.
                if (next === undefined) {epoch = crypto.randomUUID(); index = 0;} else index = next;
                currentURL = target.href;
                currentState = {...event.state, cibDraftIndex: index, cibDraftEpoch: epoch};
                replace.call(history, currentState, "");
                return;
            }
            event.stopImmediatePropagation();
            if (next === undefined) {
                // Legacy entries lack a position. Restore the visible URL/state
                // without guessing a direction or throwing away the form. On
                // confirm replace this entry with the captured destination.
                replace.call(history, currentState, "", currentURL);
                navigate(() => routes.current.replace(`${target.pathname}${target.search}${target.hash}`));
                return;
            }
            const distance = index - next;
            if (!distance) return;
            restoring = true; history.go(distance);
            navigate(() => {const resume = () => {allow = true; history.go(-distance);}; if (restoring) afterRestore = resume; else resume();});
        };
        window.addEventListener("popstate", pop, true);
        return () => {
            window.removeEventListener("popstate", pop, true);
            if (history.pushState === trackedPush) history.pushState = push;
            if (history.replaceState === trackedReplace) history.replaceState = replace;
        };
    }, [dirty, navigate, clearPage]);

    const discard = () => {
        clearPage();
        const action = pending; setPending(null); action?.();
    };
    return <DraftContext.Provider value={context}>{children}<ConfirmDialog open={pending !== null} title={t("manage.unsaved.title")} description={t("manage.unsaved.description")} confirmLabel={t("manage.unsaved.discard")} tone="danger" onCancel={() => setPending(null)} onConfirm={discard} /></DraftContext.Provider>;
}
