import {apiHost} from "@/utils/origins";
import {fetchPublic} from "@/api/publicFetch";
import {HardCache} from "./commonPageCache";
import {MISSING_HOST_TTL_MS, missingHosts} from "./missingHosts";

// Hosts the API just answered for: they cost it nothing more for the same short window as the missing ones.
const knownHosts = new HardCache<true>({maxEntries: 4096, maxBytes: 512 * 1024, ttl: MISSING_HOST_TTL_MS});

/**
 * True when the API, asked anonymously, does not know the event of this host: an unknown subdomain or an event
 * hidden from the public look the same. The page answers 404 for it; its body (the browser retries with the
 * session for staff) is not touched. Any other answer, or a failed read, is not "missing": the page keeps its 200.
 */
export async function eventHostMissing(host: string | null, read: typeof fetchPublic = fetchPublic): Promise<boolean> {
    if (!host) return false;
    if (missingHosts.has(host)) return true;
    if (knownHosts.peek(host)) return false;
    try {
        const internalOrigin = process.env.INTERNAL_API_ORIGIN;
        const response = await read(`${internalOrigin ?? `https://${apiHost}`}/api/events/self/public-info`, {
            Accept: "application/json",
            Origin: `https://${host}`,
            ...(internalOrigin ? {Host: apiHost} : {}),
        });
        if (response.status === 404) {
            missingHosts.add(host);
            return true;
        }
        if (response.status >= 200 && response.status < 300) knownHosts.set(host, true);
    } catch {
        // an unreachable API is the outage gate's business, not a missing event
    }
    return false;
}
