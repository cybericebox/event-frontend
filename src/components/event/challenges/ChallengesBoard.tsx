"use client";

import {useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {getOwnChallenges, type OwnChallenge} from "@/api/participantChallenges";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {useGuestEvent} from "@/components/event/GuestShell";
import {CountdownTimer} from "@/components/Countdown";
import {EventLoading} from "@/components/event/EventLoading";
import {ChallengeCategorySection, type ChallengeCategory} from "./ChallengeCategorySection";
import {ChallengeModal} from "./ChallengeModal";

function Centered({children}: {children: React.ReactNode}) {
    return <div className="flex min-h-[40vh] items-center justify-center">{children}</div>;
}

export function ChallengesBoard() {
    const participant = useParticipantContext();
    const guestEvent = useGuestEvent();
    const event = participant?.event ?? guestEvent;
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const started = !!event && Date.parse(event.StartTime) <= now;
    const finished = !!event?.FinishTime && Date.parse(event.FinishTime) <= now;
    useEffect(() => {
        if (started) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [started]);
    const challenges = useQuery({
        queryKey: ["event-own-challenges", event?.EventID],
        queryFn: () => getOwnChallenges(event!.EventID),
        enabled: !!participant && !!event && started,
        retry: false,
        refetchInterval: 30000,
    });
    const categories = useMemo(() => {
        const groups = new Map<string, ChallengeCategory>();
        for (const challenge of challenges.data ?? []) {
            const key = challenge.GroupID ?? "ungrouped";
            if (!groups.has(key)) groups.set(key, {ID: key, Name: challenge.GroupName || "Інші завдання", Order: challenge.GroupOrder, Challenges: []});
            groups.get(key)!.Challenges.push(challenge);
        }
        return Array.from(groups.values())
            .sort((a, b) => a.Order - b.Order || a.Name.localeCompare(b.Name, "uk"))
            .map(group => ({...group, Challenges: group.Challenges.sort((a, b) => a.Order - b.Order || a.Snapshot.name.localeCompare(b.Snapshot.name, "uk"))}));
    }, [challenges.data]);
    const selected: OwnChallenge | null = challenges.data?.find(item => item.EventChallengeID === selectedID) ?? null;

    if (!event) return <EventLoading label="Завантажуємо завдання…" />;
    if (!participant) return <Centered><div className="rounded-lg border border-border bg-card p-8 text-center"><p className="text-lg font-medium text-foreground">Завдання доступні учасникам події</p><Link className="ib-btn ib-btn--primary mt-4" href="/join">Приєднатися</Link></div></Centered>;
    if (!started) return <Centered><CountdownTimer text="Завдання стануть доступні через" until={new Date(event.StartTime)} /></Centered>;
    if (event.Participation === 1 && !participant.ownTeam) return <Centered><div className="rounded-lg border border-border bg-card p-8 text-center"><p className="text-lg font-medium text-foreground">Приєднайтесь до команди</p><p className="mt-1 text-sm text-muted-foreground">Завдання доступні лише учасникам команди.</p><Link className="ib-btn ib-btn--primary mt-4" href="/team">Моя команда</Link></div></Centered>;
    if (challenges.isPending) return <EventLoading label="Завантажуємо завдання…" />;
    if (challenges.isError) return <Centered><p className="text-sm text-destructive">Не вдалося завантажити завдання.</p></Centered>;
    if (!categories.length) return <Centered><p className="text-sm text-muted-foreground">Завдань поки немає.</p></Centered>;

    return <><div className="mx-auto w-full max-w-screen-2xl">
        {categories.map(category => <ChallengeCategorySection key={category.ID} category={category} onOpen={item => setSelectedID(item.EventChallengeID)} />)}
    </div><ChallengeModal
        challenge={selected} eventID={event.EventID} eventFinished={finished}
        open={!!selected} onOpenChange={open => {if (!open) setSelectedID(null);}}
        onSubmitted={() => void challenges.refetch()}
    /></>;
}
