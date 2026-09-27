"use client";

import {useQuery} from "@tanstack/react-query";
import {z} from "zod";
import {ContentValueSchema, type ContentDocument, type ContentValue} from "@/types/eventContent";
import {ContentBlocks} from "./ContentBlocks";

const valuesSchema = z.object({Variables: z.record(z.string(), ContentValueSchema)});

export function LiveContentBlocks({eventID, document, initialVariables, coverImage, title, page}: {
    eventID: string;
    document: ContentDocument;
    initialVariables: Record<string, ContentValue>;
    coverImage?: string;
    title?: string;
    page?: string;
}) {
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
    const currentValues = values.isError ? {...(values.data ?? initialVariables), "event.registrationOpen": false} : values.data ?? initialVariables;
    return <ContentBlocks document={document} variables={currentValues} coverImage={coverImage} title={title} eventID={eventID} />;
}
