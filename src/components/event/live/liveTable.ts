// Paging of the live results table: the top rows stay pinned on every page,
// the rest scroll page by page, and the last page is topped up with rows of
// the previous one so it is never half empty.

export const livePinOptions = [0, 3, 5] as const;
export const livePinDefault = 3;

export type LiveTablePage<T> = {
    rows: T[];
    // Pinned rows at the top of `rows`.
    pinned: number;
    // 1-based positions of the scrolling rows on this page, and the total.
    from: number;
    to: number;
    total: number;
    page: number;
    pageCount: number;
};

export function livePinTop(value: unknown): number {
    const number = Number(value);
    return (livePinOptions as readonly number[]).includes(number) ? number : livePinDefault;
}

export function liveTablePage<T>(teams: T[], {pageSize, pinTop, page}: {pageSize: number; pinTop: number; page: number}): LiveTablePage<T> {
    const size = Math.max(1, Math.floor(pageSize));
    const total = teams.length;
    if (total <= size) return {rows: teams, pinned: 0, from: total ? 1 : 0, to: total, total, page: 0, pageCount: 1};
    // Pinning needs at least one scrolling row on the page.
    const pinned = pinTop < size ? Math.max(0, pinTop) : 0;
    const per = size - pinned;
    const rest = total - pinned;
    const pageCount = Math.ceil(rest / per);
    const index = ((Math.floor(page) % pageCount) + pageCount) % pageCount;
    const start = pinned + Math.min(index * per, rest - per);
    // The first page shows places 1 to N, the pinned ones included.
    return {rows: [...teams.slice(0, pinned), ...teams.slice(start, start + per)], pinned, from: index === 0 ? 1 : start + 1, to: start + per, total, page: index, pageCount};
}

// The page shown at `now`: pages turn every `pageSeconds`. The editor preview
// stays on the first page. `elapsed` is the time into the page, in seconds.
export function liveTablePageAt(now: number, pageSeconds: number, edit: boolean): {page: number; elapsed: number} {
    if (edit) return {page: 0, elapsed: 0};
    const seconds = Math.max(1, pageSeconds);
    return {page: Math.floor(now / 1000 / seconds), elapsed: (now / 1000) % seconds};
}

// Points with narrow no-break spaces between the thousands (U+202F): the
// monospace digits do not get a wide gap.
export function livePoints(points: number): string {
    return Math.round(points).toLocaleString("uk-UA").replace(/\s/g, " ");
}
