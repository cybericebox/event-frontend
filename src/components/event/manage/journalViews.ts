import type {AttemptFilters} from "@/api/manageAttempts";
import {localFromISO} from "@/components/ui/dateTimePicker";

// «Журнал спроб» views, addressed as /manage/submissions?tab=<view>.
export const journalViews = ["attempts", "hints"] as const;
export type JournalView = typeof journalViews[number];

export function journalViewFromParams(tab: string | undefined): JournalView {
    return tab === "hints" ? "hints" : "attempts";
}

// Filters an outside link (an integrity signal) may preset on the attempts view:
// /manage/submissions?tab=attempts&challengeId=…&teamId=…&from=<ISO>&to=<ISO>.
// Times arrive as ISO instants and become the picker's wall-clock values.
export type JournalFilterParams = {teamId?: string; challengeId?: string; from?: string; to?: string};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function journalFiltersFromParams(params: JournalFilterParams): Partial<AttemptFilters> {
    const filters: Partial<AttemptFilters> = {};
    if (params.teamId && uuidPattern.test(params.teamId)) filters.teamID = params.teamId;
    if (params.challengeId && uuidPattern.test(params.challengeId)) filters.challengeID = params.challengeId;
    const from = params.from ? localFromISO(params.from, true) : "";
    const to = params.to ? localFromISO(params.to, true) : "";
    if (from) filters.from = from;
    if (to) filters.to = to;
    return filters;
}
