// All service origins derive from the one public domain as <service>.<domain>.
// NEXT_PUBLIC_{API,ID,EXERCISES,ADMIN}_DOMAIN override a single host (bare host, no
// scheme), e.g. to point this app at another backend. Event sites always stay
// <tag>.<domain>. Empty origin means the domain is not configured.
const domain = process.env.NEXT_PUBLIC_DOMAIN?.trim() ?? "";
export const publicDomain = domain;

const host = (override: string | undefined, fallback: string) => override?.trim() || fallback;
const origin = (value: string) => value ? `https://${value}` : "";

// Bare API host: server-side fetches send it as Host when going through INTERNAL_API_ORIGIN.
export const apiHost = host(process.env.NEXT_PUBLIC_API_DOMAIN, domain && `api.${domain}`);
export const apiOrigin = origin(apiHost);
export const idOrigin = origin(host(process.env.NEXT_PUBLIC_ID_DOMAIN, domain && `id.${domain}`));
export const exercisesOrigin = origin(host(process.env.NEXT_PUBLIC_EXERCISES_DOMAIN, domain && `exercises.${domain}`));
export const adminOrigin = origin(host(process.env.NEXT_PUBLIC_ADMIN_DOMAIN, domain && `admin.${domain}`));
// The platform landing (apex).
export const mainOrigin = origin(domain);

// API origin for calls that cannot work without one.
export function requireApiOrigin(): string {
    if (!apiOrigin) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    return apiOrigin;
}

// The public site of an event: <tag>.<domain>.
export function eventOrigin(tag: string): string {
    return domain ? `https://${tag}.${domain}` : "";
}
