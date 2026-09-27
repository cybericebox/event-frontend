// The server reserves this range for custom pages shown before Challenges.
export const beforeChallengesLimit = -500_000_000;

export function beforeChallenges(order: number) {
    return order < beforeChallengesLimit;
}
