// Pure reorder helpers shared by every sortable list.

// The list with the item at `from` moved to `to` (the others shift by one).
// Out-of-range or no-op moves return the same array.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}

// The move a drop makes: the dragged id lands at the index of the id it is
// over. null when either id is unknown or nothing changes.
export function dropMove(ids: string[], activeID: string, overID: string | null): {from: number; to: number} | null {
    if (overID === null) return null;
    const from = ids.indexOf(activeID);
    const to = ids.indexOf(overID);
    return from < 0 || to < 0 || from === to ? null : {from, to};
}
