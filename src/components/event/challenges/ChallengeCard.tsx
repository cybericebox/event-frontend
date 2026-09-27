import {Check} from "lucide-react";
import type {OwnChallenge} from "@/api/participantChallenges";
import {cn} from "@/utils/cn";

export function ChallengeCard({challenge, onOpen}: {challenge: OwnChallenge; onOpen: (item: OwnChallenge) => void}) {
    const solved = !!challenge.SolvedAt;
    return <button type="button" onClick={() => onOpen(challenge)} className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-[14px] border p-4 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        solved ? "border-success/40 bg-success/[0.07]" : "border-border bg-card hover:border-primary/50",
    )}>
        <span className="flex items-baseline justify-between gap-2.5">
            <span className="min-w-0 text-[15px] font-medium text-foreground">{challenge.Snapshot.name}</span>
            <span className="shrink-0 font-mono text-sm font-bold text-primary">{challenge.Points}</span>
        </span>
        {solved && <span className="flex items-center gap-1.5 border-t border-border pt-2.5 text-xs font-medium text-success"><Check className="size-4" />Вирішено</span>}
    </button>;
}
