"use client";

import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {z} from "zod";
import {ContentValueSchema, type ContentDocument, type ContentValue} from "@/types/eventContent";
import {ContentBlocks} from "./ContentBlocks";
import {applyLifecycleBoundaries, nextContentRefreshAt} from "./contentRefresh";

const valuesSchema = z.object({Variables: z.record(z.string(), ContentValueSchema)});

export function LiveContentBlocks({eventID, document, initialVariables, coverImage, title, page}: {
    eventID: string;
    document: ContentDocument;
    initialVariables: Record<string, ContentValue>;
    coverImage?: string;
    title?: string;
    page?: string;
}) {
    const [now, setNow] = useState(() => Date.now());
    const values = useQuery({
        queryKey: ["public-content-values", eventID, page ?? "landing"],
        queryFn: async () => {
            const params = new URLSearchParams({eventId: eventID});
            if (page) params.set("page", page);
            const response = await fetch(`/api/content/values?${params}`, {cache: "no-store"});
            if (!response.ok) throw new Error(`Public values unavailable: ${response.status}`);
            return valuesSchema.parse(await response.json()).Variables;
        },
        initialData: initialVariables,
        staleTime: 60_000,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: false,
    });
    const {data: liveValues, refetch} = values;
    useEffect(() => {
        const next = nextContentRefreshAt(liveValues ?? initialVariables, Date.now());
        if (next === null) return;
        let timer: number | undefined;
        const schedule = () => {
            const remaining = next - Date.now();
            if (remaining <= 0) {
                setNow(Date.now());
                void refetch();
            } else {
                timer = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
            }
        };
        schedule();
        return () => { if (timer !== undefined) window.clearTimeout(timer); };
    }, [liveValues, refetch, initialVariables, now]);
    const currentValues = applyLifecycleBoundaries(values.isError ? {...(values.data ?? initialVariables), "event.registrationOpen": false} : values.data ?? initialVariables, now);
    return <ContentBlocks document={document} variables={currentValues} coverImage={coverImage} title={title} eventID={eventID} />;
}
