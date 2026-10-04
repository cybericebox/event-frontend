// Every host derives from the one base domain NEXT_PUBLIC_DOMAIN (src/utils/hosts.ts), with no per-host settings and no fallbacks.
// Next inlines the literal process.env accesses, so each is read by name.
import {hosts} from "@/utils/hosts";

function required(value: string | undefined, name: string): string {
    const v = value?.trim();
    if (!v) throw new Error(`${name} is required`);
    return v;
}
const origin = (host: string) => `https://${host}`;

const h = hosts();
// The parent of the event sites (<tag>.<domain>) and of the shared cookies.
export const publicDomain = h.eventDomain;

// Bare API host: server-side fetches send it as Host when going through INTERNAL_API_ORIGIN.
export const apiHost = h.api;
export const apiOrigin = origin(apiHost);
export const idOrigin = origin(h.id);
export const exercisesOrigin = origin(h.exercises);
export const adminOrigin = origin(h.admin);
// The platform landing.
export const mainOrigin = origin(h.main);

// Kept for call sites that need an API origin; the host is always configured.
export function requireApiOrigin(): string {
    return apiOrigin;
}

// The public site of an event: <tag>.<base domain>.
export function eventOrigin(tag: string): string {
    return `https://${tag}.${publicDomain}`;
}

// External links, from env (no fallbacks).
export const partnerIceNureUrl = required(process.env.NEXT_PUBLIC_PARTNER_ICE_NURE_URL, "NEXT_PUBLIC_PARTNER_ICE_NURE_URL");
export const partnerNureUrl = required(process.env.NEXT_PUBLIC_PARTNER_NURE_URL, "NEXT_PUBLIC_PARTNER_NURE_URL");
export const wireguardInstallUrl = required(process.env.NEXT_PUBLIC_WIREGUARD_INSTALL_URL, "NEXT_PUBLIC_WIREGUARD_INSTALL_URL");
