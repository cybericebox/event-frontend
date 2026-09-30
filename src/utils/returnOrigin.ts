import {adminOrigin} from "@/utils/origins";

// The place a user came from, for the «return» button at the bottom of the /manage sidebar.
// Only the platform admin counts, and only its own host, so a crafted `from` cannot become an open redirect.
const ADMIN_KEY = "cybericebox.return.admin";
export const FROM_PARAM = "from";
export const FROM_NAME_PARAM = "from_name";

// The admin address in `value` when it is on our admin host, else null. Fragments are dropped.
export function validAdminReturn(value: string | null | undefined, origin: string = adminOrigin): string | null {
    if (!value || !origin) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password || url.host !== new URL(origin).host) return null;
        url.hash = "";
        return url.href;
    } catch {
        return null;
    }
}

// Reads the admin origin from the address (`?from=`) and the session; a valid one from the address is remembered.
export function readAdminReturn(search: string, storage: Pick<Storage, "getItem" | "setItem"> | null, origin: string = adminOrigin): string | null {
    const fromAddress = validAdminReturn(new URLSearchParams(search).get(FROM_PARAM), origin);
    if (fromAddress) {
        try {storage?.setItem(ADMIN_KEY, fromAddress);} catch { /* Session storage may be unavailable; the origin lasts for this page. */ }
        return fromAddress;
    }
    try {
        return validAdminReturn(storage?.getItem(ADMIN_KEY), origin);
    } catch {
        return null;
    }
}

// The admin link from a /manage page carries the page and the event name, so admin can offer the way back.
export function withManageOrigin(href: string, manageURL: string, eventName: string): string {
    const params = new URLSearchParams({[FROM_PARAM]: manageURL, [FROM_NAME_PARAM]: eventName});
    return `${href}${href.includes("?") ? "&" : "?"}${params}`;
}
