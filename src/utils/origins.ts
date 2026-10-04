// Every host comes from the deployment env, with no fallbacks and no derivation.
// NEXT_PUBLIC_{MAIN,API,ID,ADMIN,EXERCISES}_HOST are bare hosts (no scheme);
// NEXT_PUBLIC_EVENT_DOMAIN is the parent of the event sites (<tag>.<domain>).
// Next inlines the literal process.env accesses below, so each is read by name.
function required(value: string | undefined, name: string): string {
    const v = value?.trim();
    if (!v) throw new Error(`${name} is required`);
    return v;
}
const origin = (host: string) => `https://${host}`;

export const publicDomain = required(process.env.NEXT_PUBLIC_EVENT_DOMAIN, "NEXT_PUBLIC_EVENT_DOMAIN");

// Bare API host: server-side fetches send it as Host when going through INTERNAL_API_ORIGIN.
export const apiHost = required(process.env.NEXT_PUBLIC_API_HOST, "NEXT_PUBLIC_API_HOST");
export const apiOrigin = origin(apiHost);
export const idOrigin = origin(required(process.env.NEXT_PUBLIC_ID_HOST, "NEXT_PUBLIC_ID_HOST"));
export const exercisesOrigin = origin(required(process.env.NEXT_PUBLIC_EXERCISES_HOST, "NEXT_PUBLIC_EXERCISES_HOST"));
export const adminOrigin = origin(required(process.env.NEXT_PUBLIC_ADMIN_HOST, "NEXT_PUBLIC_ADMIN_HOST"));
// The platform landing.
export const mainOrigin = origin(required(process.env.NEXT_PUBLIC_MAIN_HOST, "NEXT_PUBLIC_MAIN_HOST"));

// Kept for call sites that need an API origin; the host is always configured.
export function requireApiOrigin(): string {
    return apiOrigin;
}

// The public site of an event: <tag>.<NEXT_PUBLIC_EVENT_DOMAIN>.
export function eventOrigin(tag: string): string {
    return `https://${tag}.${publicDomain}`;
}

// External links, from env (no fallbacks).
export const partnerIceNureUrl = required(process.env.NEXT_PUBLIC_PARTNER_ICE_NURE_URL, "NEXT_PUBLIC_PARTNER_ICE_NURE_URL");
export const partnerNureUrl = required(process.env.NEXT_PUBLIC_PARTNER_NURE_URL, "NEXT_PUBLIC_PARTNER_NURE_URL");
export const wireguardInstallUrl = required(process.env.NEXT_PUBLIC_WIREGUARD_INSTALL_URL, "NEXT_PUBLIC_WIREGUARD_INSTALL_URL");
