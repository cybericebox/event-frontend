"use client"

import { useState } from "react"
import Link from "next/link"
import { useEvent } from "@/hooks/useEvent"
import { useTeam } from "@/hooks/useTeam"
import { useChallenge } from "@/hooks/useChallenge"
import { ParticipationTypeEnum } from "@/types/event"
import { CountdownTimer } from "@/components/Countdown"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ChallengeCategorySection } from "./ChallengeCategorySection"
import { ChallengeModal } from "./ChallengeModal"
import type { IChallengeInfo, IChallengeInfoCategoryInfo } from "@/types/challenge"

// Shared centering wrapper for the board's gate states (loading / countdown /
// no-team CTA) — mirrors the prototype's centered placeholder blocks.
function Centered({ children }: { children: React.ReactNode }) {
    return <div className="flex min-h-[40vh] items-center justify-center">{children}</div>
}

// Orchestrator for the participant challenges board: resolves the event/team
// gates (before-start countdown, team-required CTA), the challenges-query
// states (loading/error/empty), then renders the category sections and owns
// the shared challenge-modal open state. Wired into the page in a later task.
export function ChallengesBoard() {
    const [selected, setSelected] = useState<IChallengeInfo | null>(null)

    const { GetEventInfoResponse, GetEventInfoRequest } = useEvent().useGetEventInfo()
    const event = GetEventInfoResponse?.Data
    const now = Date.now()
    const started = !!event && new Date(event.StartTime).getTime() <= now
    const finished = !!event && new Date(event.FinishTime).getTime() < now
    const needsTeam = event?.Participation === ParticipationTypeEnum.Team

    const { GetTeamResponse, GetTeamRequest } = useTeam().useGetTeam()
    const hasTeam = GetTeamRequest.isSuccess && !!GetTeamResponse?.Data?.Name

    // Enable the challenges query only once the gates would let the board render.
    const canLoad = started && (!needsTeam || hasTeam)
    const { GetChallengesResponse, GetChallengesRequest } = useChallenge().useGetChallenges(canLoad)
    const categories: IChallengeInfoCategoryInfo[] = GetChallengesResponse?.Data ?? []

    // 1. Event loading.
    if (GetEventInfoRequest.isLoading || !event)
        return (
            <Centered>
                <Spinner size="md" className="text-primary" />
            </Centered>
        )

    // 2. Before start.
    if (!started)
        return (
            <Centered>
                <CountdownTimer text="Завдання стануть доступні через" until={new Date(event.StartTime)} />
            </Centered>
        )

    // 3. Team required but no team (only for Team participation).
    if (needsTeam && !hasTeam) {
        if (GetTeamRequest.isLoading)
            return (
                <Centered>
                    <Spinner size="md" className="text-primary" />
                </Centered>
            )
        return (
            <Centered>
                <div className="rounded-lg border border-border bg-card p-8 text-center">
                    <p className="text-lg font-medium text-foreground">Приєднайтесь до команди</p>
                    <p className="mt-1 text-sm text-muted-foreground">Завдання доступні лише учасникам команди.</p>
                    <Button asChild className="mt-4">
                        <Link href="/cabinet">Кабінет команди</Link>
                    </Button>
                </div>
            </Centered>
        )
    }

    // 4. Board states.
    if (GetChallengesRequest.isLoading)
        return (
            <Centered>
                <Spinner size="md" className="text-primary" />
            </Centered>
        )
    if (GetChallengesRequest.isError)
        return (
            <Centered>
                <p className="text-sm text-destructive">Не вдалося завантажити завдання.</p>
            </Centered>
        )
    if (!categories.length)
        return (
            <Centered>
                <p className="text-sm text-muted-foreground">Завдань поки немає.</p>
            </Centered>
        )

    return (
        <>
            <div className="mx-auto w-full max-w-screen-2xl">
                {categories.map((cat) => (
                    <ChallengeCategorySection key={cat.ID} category={cat} onOpen={setSelected} />
                ))}
            </div>
            <ChallengeModal
                challenge={selected}
                categoryName={categories.find((c) => c.Challenges.some((ch) => ch.ID === selected?.ID))?.Name}
                eventFinished={finished}
                open={!!selected}
                onOpenChange={(o) => {
                    if (!o) setSelected(null)
                }}
            />
        </>
    )
}
