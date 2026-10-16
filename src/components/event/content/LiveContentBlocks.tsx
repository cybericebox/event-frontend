"use client";

import type {ContentImageDimensions} from "@/types/contentImages";
import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {z} from "zod";
import {ContentValueSchema, type ContentDocument, type ContentValue} from "@/types/eventContent";
import {ContentBlocks} from "./ContentBlocks";
import {applyLifecycleBoundaries, nextContentRefreshAt} from "./contentRefresh";

const valuesSchema = z.object({Revision:z.string(),Variables: z.record(z.string(), ContentValueSchema)});

// Only these variables represent live statistics. Dates, registration and layout
// come from the versioned server snapshot, never from an independent count poll.
const liveVariableNames = new Set([
    "event.teamCount", "event.approvedTeamCount", "event.participantCount", "event.approvedParticipantCount",
    "event.challengeCount", "event.availableChallengeCount", "event.solvedChallengeCount", "event.solveCount", "event.registrationUnitCount",
]);

export function LiveContentBlocks({eventID, document, initialVariables, coverImage, title, page, revision, imageDimensions}: {
    eventID: string;
    document: ContentDocument;
    initialVariables: Record<string, ContentValue>;
    coverImage?: string;
    title?: string;
    page?: string;
    revision?: string;
    imageDimensions?: ContentImageDimensions;
}) {
    const [now, setNow] = useState(() => Date.now());
    const serializedDocument = JSON.stringify(document);
    const hasLiveValues = [...liveVariableNames].some(name => serializedDocument.includes(name));
    const values = useQuery({
        enabled: hasLiveValues,
        queryKey: ["public-content-values", eventID, page ?? "landing", revision],
        queryFn: async () => {
            const params = new URLSearchParams({eventId: eventID});
            if (page) params.set("page", page);
            const response = await fetch(`/api/content/values?${params}`, {cache: "no-store"});
            if (!response.ok) throw new Error(`Public values unavailable: ${response.status}`);
            const result = valuesSchema.parse(await response.json());
            if (result.Revision !== revision) throw new Error("Content source revision changed");
            return Object.fromEntries(Object.entries(result.Variables).filter(([name]) => liveVariableNames.has(name)));
        },
        initialData: Object.fromEntries(Object.entries(initialVariables).filter(([name]) => liveVariableNames.has(name))),
        staleTime: 60_000,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: false,
    });

    useEffect(() => {
        const next = nextContentRefreshAt(initialVariables, Date.now());
        if (next === null) return;
        let timer: number | undefined;
        const schedule = () => {
            const remaining = next - Date.now();
            if (remaining <= 0) {
                setNow(Date.now());
            } else {
                timer = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
            }
        };
        schedule();
        return () => { if (timer !== undefined) window.clearTimeout(timer); };
    }, [initialVariables, now]);
    // A failed refresh keeps the last good values: one missed poll must not hide «Приєднатися».
    const currentValues = applyLifecycleBoundaries({...initialVariables, ...values.data}, now);
    return <ContentBlocks imageDimensions={imageDimensions} document={document} variables={currentValues} coverImage={coverImage} title={title} eventID={eventID} />;
}
