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

// A super admin without a second factor is held at enrolment: the backend answers 403 with
// SECOND_FACTOR_ENROLMENT_REQUIRED (full code 63812; the detail code, as the API errors carry it, is 3812).
export const SECOND_FACTOR_ENROLMENT_REQUIRED = 3812;

// Where such an answer sends the visitor: the ID second-factor page with the current address as
// return_to. The site home when ID is not configured or the address already is on ID, so two
// redirects never bounce.
export function secondFactorRedirectTarget(returnTo: string, id: string = idOrigin): string {
    if (!id) return "/";
    if (returnTo === id || returnTo.startsWith(`${id}/`) || returnTo.startsWith(`${id}?`)) return "/";
    return `${id}/second-factor/?return_to=${encodeURIComponent(returnTo)}`;
}

// Leaves for the enrolment page; replace() keeps the held page out of the history.
export function redirectToSecondFactor(): void {
    if (typeof window === "undefined") return;
    const target = secondFactorRedirectTarget(window.location.href);
    if (target !== "/") window.location.replace(target);
}
