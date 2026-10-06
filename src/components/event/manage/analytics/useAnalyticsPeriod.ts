"use client";

import {useMemo, useState} from "react";
import type {AnalyticsPeriod} from "@/api/manageAnalytics";
import {emptyPeriodDraft, periodInvalid, periodOf, periodSet, type PeriodDraft} from "./analyticsModel";

// The period filter state of a section page. `period` is what the queries send
// (null bounds: the event's own window); an invalid draft is not sent.
export function useAnalyticsPeriod() {
    const [draft, setDraft] = useState<PeriodDraft>(emptyPeriodDraft);
    const requested = useMemo(() => periodOf(draft), [draft]);
    const invalid = periodInvalid(requested);
    const period: AnalyticsPeriod = invalid ? {from: null, to: null} : requested;
    return {
        draft, period, invalid, set: periodSet(draft),
        setFrom: (from: string) => setDraft(current => ({...current, from})),
        setTo: (to: string) => setDraft(current => ({...current, to})),
        reset: () => setDraft(emptyPeriodDraft),
    };
}
