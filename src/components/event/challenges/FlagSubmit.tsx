"use client";

import {useState} from "react";
import {Check} from "lucide-react";
import {useMutation} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {submitChallenge} from "@/api/participantChallenges";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";

export function FlagSubmit({eventID, challengeID, solved, eventFinished, onSubmitted}: {
    eventID: string;
    challengeID: string;
    solved: boolean;
    eventFinished: boolean;
    onSubmitted: () => void;
}) {
    const [answer, setAnswer] = useState("");
    const submission = useMutation({
        mutationFn: (value: string) => submitChallenge(eventID, challengeID, value, crypto.randomUUID()),
        onSuccess: result => {
            if (result.Correct) {
                toast.success("Прапор прийнято!");
                setAnswer("");
                onSubmitted();
            } else {
                toast.error("Невірний прапор");
            }
        },
        onError: () => toast.error("Не вдалося надіслати прапор"),
    });
    if (solved) return <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/[0.09] px-4 py-3 text-success"><Check className="size-4 shrink-0" /><span className="text-sm font-semibold">Прапор уже прийнято — завдання вирішено вашою командою.</span></div>;
    if (eventFinished) return <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">Відповіді більше не приймаються.</div>;
    return <form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => {event.preventDefault(); const value = answer.trim(); if (value && !submission.isPending) submission.mutate(value);}}>
        <Input value={answer} onChange={event => setAnswer(event.target.value)} placeholder="CTF{...}" aria-label="Прапор" className="min-w-0 font-mono" disabled={submission.isPending} />
        <Button type="submit" disabled={submission.isPending || !answer.trim()}>Здати</Button>
    </form>;
}
