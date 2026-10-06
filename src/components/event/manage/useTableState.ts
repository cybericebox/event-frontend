"use client";

import {useEffect, useState} from "react";
import {MANAGE_PAGE_SIZES} from "./ManageTable";
import {toTableFilters, type FilterDrafts, type FilterSpec, type TableFilter, type TableSort} from "./tableFilterModel";

// Search, column filters, sort and page of a manage table (offset mode).
// Search and filter edits apply after a short pause; any change of what is
// listed returns to the first page.
export function useTableState(specs: FilterSpec[], defaultSort: TableSort) {
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [drafts, setDraftsState] = useState<FilterDrafts>({});
    const [applied, setApplied] = useState("[]");
    const [sort, setSortState] = useState<TableSort>(defaultSort);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSizeState] = useState(MANAGE_PAGE_SIZES[0]);
    const filters = toTableFilters(specs, drafts);
    const filtersKey = JSON.stringify(filters);

    useEffect(() => {
        const next = search.trim();
        if (next === debounced) return;
        const id = setTimeout(() => {setDebounced(next); setPage(1);}, 300);
        return () => clearTimeout(id);
    }, [search, debounced]);

    useEffect(() => {
        if (filtersKey === applied) return;
        const id = setTimeout(() => {setApplied(filtersKey); setPage(1);}, 300);
        return () => clearTimeout(id);
    }, [filtersKey, applied]);

    return {
        search, setSearch, debounced, drafts, filters,
        appliedFilters: JSON.parse(applied) as TableFilter[], appliedKey: applied,
        sort, page, pageSize,
        active: filters.length,
        filtered: !!debounced || applied !== "[]",
        anyFilter: !!search.trim() || filters.length > 0,
        setDrafts: setDraftsState,
        setSort(next: TableSort) {setSortState(next); setPage(1);},
        setPage,
        setPageSize(size: number) {setPageSizeState(size); setPage(1);},
        reset() {setSearch(""); setDebounced(""); setDraftsState({}); setApplied("[]"); setPage(1);},
    };
}
