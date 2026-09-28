// The server reserves this range for custom pages shown before Challenges.
export const beforeChallengesLimit = -500_000_000;

export function beforeChallenges(order: number) {
    return order < beforeChallengesLimit;
}

// One order for the navbar, the manager sidebar and the page editor.
export function comparePageOrder(a: {NavigationOrder: number; Slug: string}, b: {NavigationOrder: number; Slug: string}) {
    return a.NavigationOrder - b.NavigationOrder || a.Slug.localeCompare(b.Slug);
}
