"use client"
import { useState } from "react"
import { Check } from "lucide-react"
import toast from "react-hot-toast"
import { useChallenge } from "@/hooks/useChallenge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Flag submission form for the challenge modal. Renders one of three states:
// already solved (accepted banner), event finished (submissions closed banner),
// or the active input + submit button.
export function FlagSubmit({
    challengeID,
    solved,
    eventFinished,
}: {
    challengeID: string
    solved: boolean
    eventFinished: boolean
}) {
    const [flag, setFlag] = useState("")
    const { SolveChallenge, PendingSolveChallenge } = useChallenge().useSolveChallenge(challengeID)

    // Already solved — show the accepted state instead of an input.
    if (solved) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/[0.09] px-4 py-3 text-success">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-white">
                    <Check className="size-[11px]" strokeWidth={3} />
                </span>
                <span className="text-sm font-semibold">Прапор уже прийнято — завдання вирішено вашою командою.</span>
            </div>
        )
    }

    // Event finished — submissions closed.
    if (eventFinished) {
        return (
            <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                Відповіді більше не приймаються.
            </div>
        )
    }

    const submit = () => {
        const value = flag.trim()
        if (!value) return
        SolveChallenge(
            { Solution: value },
            {
                onSuccess: (res) => {
                    const ok = res.data?.Data?.Solved
                    if (ok) {
                        toast.success("Прапор прийнято!")
                        setFlag("")
                    } else {
                        toast.error("Невірний прапор")
                    }
                },
                onError: () => toast.error("Помилка надсилання прапора"),
            }
        )
    }

    return (
        <div className="flex gap-2">
            <Input
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") submit()
                }}
                placeholder="CTF{...}"
                className="font-mono"
                disabled={PendingSolveChallenge}
            />
            <Button onClick={submit} disabled={PendingSolveChallenge || !flag.trim()}>
                Здати
            </Button>
        </div>
    )
}
