export type ExercisesTab = "sets" | "unlocks";

export const exercisesTabs: {value: ExercisesTab; labelKey: string}[] = [
    {value: "sets", labelKey: "manage.exercises.tabs.sets"},
    {value: "unlocks", labelKey: "manage.exercises.tabs.unlocks"},
];

// `?tab=unlocks` opens the hint unlocks journal; anything else opens the sets.
export function exercisesTabFromParam(tab: string | null | undefined): ExercisesTab {
    return exercisesTabs.find(item => item.value === tab)?.value ?? "sets";
}

export function exercisesTabHref(tab: ExercisesTab): string {
    return tab === "sets" ? "/manage/exercises" : `/manage/exercises?tab=${tab}`;
}
