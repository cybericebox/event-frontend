import {idOrigin} from "@/utils/origins";

// Where an unauthenticated page (401) sends the visitor: the ID sign-in with the
// current address as return_to, so sign-in lands back on the same page. When the
// address is already the sign-in page (or ID is not configured) it goes to the site
// home instead, so two redirects can never bounce each other.
export function signInRedirectTarget(returnTo: string, id: string = idOrigin): string {
    if (!id) return "/";
    if (returnTo === id || returnTo.startsWith(`${id}/`) || returnTo.startsWith(`${id}?`)) return "/";
    return `${id}/sign-in?return_to=${encodeURIComponent(returnTo)}`;
}
