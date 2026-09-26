import {cache} from "react";
import {headers} from "next/headers";
import {z} from "zod";
import {PublicEventInfoSchema, type PublicEventInfo} from "@/types/publicEventInfo";

export type {PublicEventInfo} from "@/types/publicEventInfo";

// The server fetch uses the incoming event host as Origin because the API
// resolves its event tenant from that header. It can read public events only:
// the host-only API session cookie is never sent to the event frontend server.
// React cache deduplicates the metadata and layout reads within one render.
export const getPublicEventInfo = cache(async (): Promise<PublicEventInfo | null> => {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return {
            EventID: "01900000-0000-7000-8000-000000000001",
            Tag: "winter-arena-2026",
            Name: "Winter Arena CTF",
            StartTime: new Date(Date.now() - 3_600_000).toISOString(),
            FinishTime: new Date(Date.now() + 6 * 3_600_000).toISOString(),
            Status: 2,
            Participation: 1,
            Registration: 2,
            ScoreboardVisibility: 2,
            ParticipantsVisibility: 2,
            PreviewDescription: "",
            PreviewPicture: "",
            Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
        };
    }
    const host = (await headers()).get("host");
    if (!host) return null;
    const apiHost = `api.${process.env.NEXT_PUBLIC_DOMAIN}`;
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    const response = await fetch(`${internalOrigin ?? `https://${apiHost}`}/api/events/self/public-info`, {
        headers: {
            Accept: "application/json",
            Origin: `https://${host}`,
            ...(internalOrigin ? {Host: apiHost} : {}),
        },
        cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Event info request failed: ${response.status}`);
    const body: unknown = await response.json();
    const envelope = z.object({Data: PublicEventInfoSchema}).safeParse(body);
    if (!envelope.success) throw new Error("Invalid public event info response");
    return envelope.data.Data;
});
