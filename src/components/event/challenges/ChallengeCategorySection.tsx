import type { IChallengeInfo, IChallengeInfoCategoryInfo } from "@/types/challenge"
import { ChallengeCard } from "./ChallengeCard"

// uk plural helper for count nouns (1 завдання / 2-4 завдання / 5+ завдань).
// Inline, mirrors the `plural()` helper in the prototype — no i18n lib
// (see REDESIGN.md §6: "uk copy, JSON-lookup t() only").
function pluralUk(n: number, one: string, few: string, many: string) {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod100 >= 11 && mod100 <= 14) return many
    if (mod10 === 1) return one
    if (mod10 >= 2 && mod10 <= 4) return few
    return many
}

// One category section of the participant challenges board: a colored bar +
// category name + muted challenge count, followed by a responsive grid of
// ChallengeCard leaves. Matches `pageChallenges`'s per-category section in
// `.event-app.html`. Pure presentational — no "use client" (see ChallengeCard).
export function ChallengeCategorySection({
    category,
    onOpen,
}: {
    category: IChallengeInfoCategoryInfo
    onOpen: (c: IChallengeInfo) => void
}) {
    const count = category.Challenges.length

    return (
        <section className="mb-6">
            <div className="mb-3 flex items-center gap-2.5">
                <span className="h-[18px] w-1 shrink-0 rounded-[3px] bg-primary" />
                <h2 className="m-0 text-[15px] font-bold text-foreground">
                    {category.Name}
                </h2>
                <span className="text-[12.5px] text-muted-foreground">
                    {count} {pluralUk(count, "завдання", "завдання", "завдань")}
                </span>
            </div>

            <div
                className="grid gap-3.5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}
            >
                {category.Challenges.map((challenge) => (
                    <ChallengeCard
                        key={challenge.ID}
                        challenge={challenge}
                        onOpen={onOpen}
                    />
                ))}
            </div>
        </section>
    )
}
