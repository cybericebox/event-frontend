"use client"
import { useChallenge } from "@/hooks/useChallenge"
import { EventLoading } from "@/components/event/EventLoading"

// "Розв'язали" tab content: list of teams that solved this challenge, newest
// data refetched by useChallengeSolvedBy on its own polling interval.
export function ChallengeSolvedBy({ challengeID }: { challengeID: string }) {
    const { ChallengeSolvedByResponse, ChallengeSolvedByRequest } =
        useChallenge().useChallengeSolvedBy(challengeID)
    const solutions = ChallengeSolvedByResponse?.Data ?? []

    if (ChallengeSolvedByRequest.isLoading)
        return <EventLoading label="Завантажуємо розв’язання…" />
    if (!solutions.length)
        return <p className="py-6 text-center text-sm text-muted-foreground">Ще ніхто не розв&apos;язав це завдання.</p>

    return (
        <ul className="flex flex-col divide-y divide-border">
            {solutions.map((s) => (
                <li key={s.ID} className="flex items-center justify-between py-2.5">
                    <span className="text-sm font-medium text-foreground">{s.Name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                        {new Date(s.SolvedAt).toLocaleString("uk-UA")}
                    </span>
                </li>
            ))}
        </ul>
    )
}
