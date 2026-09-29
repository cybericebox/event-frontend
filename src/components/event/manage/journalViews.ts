// «Журнал спроб» views, addressed as /manage/submissions?tab=<view>.
export const journalViews = ["attempts", "hints"] as const;
export type JournalView = typeof journalViews[number];

export function journalViewFromParams(tab: string | undefined): JournalView {
    return tab === "hints" ? "hints" : "attempts";
}
