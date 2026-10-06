// Pages of a visible event that need a session. An anonymous visitor on one of them is sent
// to the ID sign-in at once (SignInRedirect). Everything else of a public event (landing,
// content pages, public results) renders without sign-in. /manage and /live check their own access.
const SESSION_ROUTES = ["/challenges", "/participation", "/team", "/forms", "/join", "/invite"];

export function needsSession(pathname: string): boolean {
    return SESSION_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}
