// Registration continues by itself after the sign-in only for a flow THIS browser started. A bare
// link (/join?continue=1) must never enrol anyone, so the return address carries a random one-time
// nonce that is also kept in sessionStorage (event-site origin, survives the ID round trip) with
// the event id and a short expiry. The join page submits only when the nonce matches, then drops it.
const KEY = "event-join-intent";
const TTL_MS = 15 * 60 * 1000;

type Intent = {nonce: string; eventID: string; expires: number};

function randomNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createJoinIntent(eventID: string, now = Date.now()): string {
    const nonce = randomNonce();
    try {
        sessionStorage.setItem(KEY, JSON.stringify({nonce, eventID, expires: now + TTL_MS} satisfies Intent));
    } catch {
        // storage blocked: the page still opens, it just will not continue by itself
    }
    return nonce;
}

// True once, for the matching, unexpired nonce of this event; every other case is false.
export function consumeJoinIntent(eventID: string, nonce: string | null, now = Date.now()): boolean {
    if (!nonce) return false;
    try {
        const raw = sessionStorage.getItem(KEY);
        sessionStorage.removeItem(KEY);
        if (!raw) return false;
        const intent = JSON.parse(raw) as Partial<Intent>;
        return intent.nonce === nonce && intent.eventID === eventID && typeof intent.expires === "number" && intent.expires > now;
    } catch {
        return false;
    }
}
