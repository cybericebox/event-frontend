import {cache} from "react";
import {headers} from "next/headers";
import {z} from "zod";
import {apiHost} from "@/utils/origins";
import {liveScreenByLinkSchema, liveScreenTokenHeader, type LiveScreenByLink} from "./manageLive";
import {SERVER_FETCH_TIMEOUT_MS} from "./publicFetch";
import {serverGet} from "./serverGet";

// What the event site's server knows about a screen link before the first
// byte: the screen itself, a final answer (the link is closed, or the event
// is missing or not published), or a temporary failure the browser retries.
export type LiveScreenStart =
    | {kind: "ok"; screen: LiveScreenByLink; serverNow: number}
    | {kind: "closed"}
    | {kind: "notFound"}
    | {kind: "failed"};

// One read per render of /live (the page and its metadata share it). The
// token goes to the daemon in a header, never in a URL, and nothing is cached:
// the answer is for this screen only.
export const getLiveScreenStart = cache(async (token: string): Promise<LiveScreenStart> => {
    const host = (await headers()).get("host");
    if (!host) return {kind: "failed"};
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    try {
        const response = await serverGet(`${internalOrigin ?? `https://${apiHost}`}/api/events/self/live-screen`, {
            Accept: "application/json",
            // The event is resolved from the Origin of its site, as for the browser.
            Origin: `https://${host}`,
            [liveScreenTokenHeader]: token,
            ...(internalOrigin ? {Host: apiHost} : {}),
        }, AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS), true);
        if (response.status === 403) return {kind: "closed"};
        if (response.status === 404) return {kind: "notFound"};
        if (response.status !== 200) {
            response.body?.cancel().catch(() => undefined);
            return {kind: "failed"};
        }
        const envelope = z.object({Data: liveScreenByLinkSchema}).safeParse(await response.json());
        return envelope.success ? {kind: "ok", screen: envelope.data.Data, serverNow: Date.now()} : {kind: "failed"};
    } catch {
        return {kind: "failed"};
    }
});
