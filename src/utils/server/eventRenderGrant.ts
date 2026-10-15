import {createPublicKey, verify} from "node:crypto";
import {z} from "zod";
import {hosts} from "@/utils/hosts";

export const READ_COOKIE = "__Host-cib-event-read";
export const ATTEMPT_COOKIE = "__Host-cib-event-attempt";
export const cookieOptions = {httpOnly: true, secure: true, sameSite: "strict", path: "/"} as const;
export const RenderKeySchema = z.object({KeyID: z.string().min(1).max(128), PublicKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/)});
export type RenderKey = z.infer<typeof RenderKeySchema>;
const claimsSchema = z.object({
    iss: z.literal("cybericebox:event-render"), aud: z.string(), sub: z.uuid(), sid: z.uuid(), event_id: z.uuid(),
    scope: z.literal("common-pages"), preview: z.boolean(), challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    iat: z.number().int().nonnegative(), exp: z.number().int().nonnegative(),
});
export type RenderClaims = z.infer<typeof claimsSchema>;

export function eventOriginFromHost(host: string | null): string | null {
    const h = hosts();
    if (!host || host.length > 253 || host !== host.toLowerCase() || !host.endsWith(`.${h.eventDomain}`)) return null;
    const tag = host.slice(0, -h.eventDomain.length - 1);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag) || tag.length > 63 || [h.api, h.admin, h.id, h.exercises, h.main].includes(host)) return null;
    return `https://${host}`;
}

/** Same-site sibling domains are not same-origin. Check before consuming a request body. */
export function validSessionRequest(request: Request): boolean {
    const origin = eventOriginFromHost(request.headers.get("host"));
    return !!origin && request.headers.get("origin") === origin
        && request.headers.get("content-type")?.split(";")[0].trim() === "application/json"
        && request.headers.get("x-cib-event-session") === "1";
}

export function verifyRenderGrant(token: string, key: RenderKey, origin: string, now = Math.floor(Date.now() / 1000)): RenderClaims | null {
    if (token.length > 8192) return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
    try {
        const header = z.object({alg: z.literal("EdDSA"), typ: z.literal("cib-event-render+jwt"), kid: z.literal(key.KeyID)}).strict().parse(JSON.parse(Buffer.from(parts[0], "base64url").toString()));
        if (!header) return null;
        const signature = Buffer.from(parts[2], "base64url");
        if (signature.length !== 64 || signature.toString("base64url") !== parts[2]) return null;
        const publicKey = createPublicKey({key: {kty: "OKP", crv: "Ed25519", x: key.PublicKey}, format: "jwk"});
        if (!verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, signature)) return null;
        const claims = claimsSchema.parse(JSON.parse(Buffer.from(parts[1], "base64url").toString()));
        if (claims.aud !== origin || claims.iat > now || claims.exp <= now || claims.exp <= claims.iat || claims.exp - claims.iat > 60) return null;
        return claims;
    } catch {return null;}
}
