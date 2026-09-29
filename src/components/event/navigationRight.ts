export type NavigationRightItem = "vpn" | "team" | "profile" | "inbox" | "account";

// The pinned right side of the event navbar, in its fixed order. The participant's items
// (team, profile) appear only when pinned; VPN only for an admitted participant (the button
// itself also hides when the event has no infrastructure); a guest has none of them.
export function navigationRight({authenticated, approved, pinned, teamMode}: {authenticated: boolean; approved: boolean; pinned: boolean; teamMode: boolean}): NavigationRightItem[] {
    if (!authenticated) return [];
    return [
        ...(approved ? ["vpn" as const] : []),
        ...(pinned && teamMode ? ["team" as const] : []),
        ...(pinned ? ["profile" as const] : []),
        "inbox",
        "account",
    ];
}
