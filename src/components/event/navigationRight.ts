export type NavigationRightItem = "vpn" | "participation" | "inbox" | "account";

// The pinned right side of the event navbar, in its fixed order. «Моя участь» (profile and, in team
// mode, the team as tabs) appears only when pinned; VPN only for an admitted participant (the button
// itself also hides when the event has no infrastructure); a guest has none of them.
export function navigationRight({authenticated, approved, pinned}: {authenticated: boolean; approved: boolean; pinned: boolean}): NavigationRightItem[] {
    if (!authenticated) return [];
    return [
        ...(approved ? ["vpn" as const] : []),
        ...(pinned ? ["participation" as const] : []),
        "inbox",
        "account",
    ];
}
