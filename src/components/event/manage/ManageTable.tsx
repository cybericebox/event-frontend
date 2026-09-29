"use client";

import {useCallback, useState, type ReactNode} from "react";
import {Search} from "lucide-react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";
import {EventLoading} from "@/components/event/EventLoading";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import "./manageTable.css";

// The admin table pattern for manage lists: a toolbar, a fixed-height scroll
// area with a sticky header, and a footer with the total, the page and the
// page size. Loading, error and empty states render centered in the scroll
// area, so the block never changes size.

export const MANAGE_PAGE_SIZES = [25, 50, 100];

// Cursor paging with a known total: pages are walked one by one, and the
// total gives "page X of Y". Any filter change restarts from the first page.
type CursorPages = {cursors: Array<string | null>; index: number; pageSize: number};

export function useCursorPages(initialPageSize = MANAGE_PAGE_SIZES[0]) {
    const [state, setState] = useState<CursorPages>({cursors: [null], index: 0, pageSize: initialPageSize});
    const next = useCallback((nextCursor: string | undefined) => {
        if (nextCursor) setState(current => ({...current, cursors: [...current.cursors.slice(0, current.index + 1), nextCursor], index: current.index + 1}));
    }, []);
    const previous = useCallback(() => setState(current => ({...current, index: Math.max(0, current.index - 1)})), []);
    const reset = useCallback(() => setState(current => current.index === 0 && current.cursors.length === 1 ? current : {...current, cursors: [null], index: 0}), []);
    const setPageSize = useCallback((pageSize: number) => setState({cursors: [null], index: 0, pageSize}), []);
    return {cursor: state.cursors[state.index] ?? null, page: state.index + 1, pageSize: state.pageSize, next, previous, reset, setPageSize};
}

export function ManageTableSearch({value, onChange, label}: {value: string; onChange: (value: string) => void; label: string}) {
    return <label className="ib-input-wrap ib-input-wrap--search event-manage-table__search">
        <Search aria-hidden="true" />
        <input className="ib-input" type="search" placeholder={label} aria-label={label} autoComplete="off" value={value} maxLength={100}
            onChange={event => onChange(event.target.value)}
            onKeyDown={event => {if (event.key === "Escape" && value) {event.stopPropagation(); onChange("");}}} />
    </label>;
}

export type ManageTableState = "loading" | "error" | "empty" | "ready";

// The table, its header row and the footer always render; loading, error and
// empty states fill the body area under the header, centered.
export function ManageTable({event, state, loadingLabel, emptyMessage, errorMessage, onRetry, busy = false, toolbar, footer, head, children}: {
    event: PublicEventInfo;
    state: ManageTableState;
    loadingLabel: string;
    emptyMessage: string;
    errorMessage: string;
    onRetry: () => void;
    busy?: boolean;
    toolbar?: ReactNode;
    footer?: ReactNode;
    head: ReactNode;
    children?: ReactNode;
}) {
    const ready = state === "ready";
    return <section className="event-manage-table">
        {toolbar && <div className="event-manage-table__toolbar">{toolbar}</div>}
        <div className="event-manage-table__scroll" aria-busy={state === "loading" || busy}>
            <table className={ready ? busy ? "is-busy" : undefined : "is-state"}>
                <thead>{head}</thead>
                {ready ? children : <tbody><tr><td className="event-manage-table__state" colSpan={1000}>
                    {state === "loading" ? <EventLoading event={event} label={loadingLabel} />
                        : state === "error" ? <div className="event-block-state" role="alert"><p className="ib-empty__text">{errorMessage}</p><button className="ib-btn ib-btn--sm" type="button" onClick={onRetry}>{t("common.retry")}</button></div>
                            : <EmptyState message={emptyMessage} />}
                </td></tr></tbody>}
            </table>
        </div>
        {footer}
    </section>;
}

export function ManageTablePagination({event, page, pageSize, total, hasNext, busy = false, onPrevious, onNext, onPageSize}: {
    event: PublicEventInfo;
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
    busy?: boolean;
    onPrevious: () => void;
    onNext: () => void;
    onPageSize: (size: number) => void;
}) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return <div className="event-manage-table__footer">
        <div className="event-manage-table__meta">
            <span>{t("manage.table.total", {count: total})}</span>
            <span>{t("manage.table.page", {page, pages})}</span>
            <span className="event-manage-table__busy">{busy && <span role="status" aria-label={t("manage.table.updating")}><EventBrandLogo event={event} className="event-loading-logo" size={16} /></span>}</span>
        </div>
        <div className="event-manage-table__pager">
            <button className="ib-btn ib-btn--sm" type="button" disabled={busy || page <= 1} onClick={onPrevious}>{t("manage.table.previous")}</button>
            <button className="ib-btn ib-btn--sm" type="button" disabled={busy || !hasNext} onClick={onNext}>{t("manage.table.next")}</button>
        </div>
        <div className="event-manage-table__size">
            <span>{t("manage.table.perPage")}</span>
            <EventSelect className="event-manage-table__size-select" ariaLabel={t("manage.table.perPage")} value={String(pageSize)} disabled={busy}
                options={MANAGE_PAGE_SIZES.map(size => ({value: String(size), label: String(size)}))} onValueChange={value => onPageSize(Number(value))} />
        </div>
    </div>;
}
