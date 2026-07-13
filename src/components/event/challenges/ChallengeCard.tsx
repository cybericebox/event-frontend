import type { KeyboardEvent } from "react"
import { Check } from "lucide-react"
import type { IChallengeInfo } from "@/types/challenge"
import { cn } from "@/utils/cn"

// Leaf card for a single challenge on the participant challenges board.
// Pure presentational: no "use client" of its own — it's always rendered inside
// an already-client board component (see ChallengeCategorySection / task 6),
// so the onClick/onKeyDown handlers below get bundled into that client boundary.
// Renders schema fields only (Name, Points, Solved); difficulty, hints and a
// per-card solve count are intentionally NOT rendered (YAGNI, see task-2 brief).
export function ChallengeCard({
    challenge,
    onOpen,
}: {
    challenge: IChallengeInfo
    onOpen: (c: IChallengeInfo) => void
}) {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onOpen(challenge)
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(challenge)}
            onKeyDown={handleKeyDown}
            className={cn(
                "flex cursor-pointer flex-col gap-2.5 rounded-[14px] border p-4 shadow-sm transition-colors",
                challenge.Solved
                    ? "border-success/40 bg-success/[0.07]"
                    : "border-border bg-card"
            )}
        >
            <div className="flex items-baseline justify-between gap-2.5">
                <p className="m-0 text-[15px] font-medium text-foreground">
                    {challenge.Name}
                </p>
                <span className="shrink-0 font-mono text-sm font-bold text-primary">
                    {challenge.Points}
                </span>
            </div>

            {challenge.Solved && (
                <div className="flex items-center gap-1.5 border-t border-border pt-2.5">
                    <span className="flex size-4 items-center justify-center rounded-full bg-success text-white">
                        <Check className="size-[11px]" strokeWidth={3} />
                    </span>
                    <span className="text-xs font-medium text-success">Вирішено</span>
                </div>
            )}
        </div>
    )
}
