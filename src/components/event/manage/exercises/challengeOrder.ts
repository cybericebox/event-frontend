import type {EventBoardChallenge, EventChallengeGroup, EventExerciseAttachment} from "@/api/manageChallenges";
import type {SnapshotPlaceholder} from "@/api/participantChallenges";
import {placeholderChips} from "@/components/event/challenges/placeholderLabel";
import {richTextPlainText} from "@/components/event/content/richTextState";

export type BoardSet = {attachment: EventExerciseAttachment; challenges: EventBoardChallenge[]};
export type GroupTask = {challenge: EventBoardChallenge; attachment: EventExerciseAttachment};
// groupID null is the «Без групи» bucket.
export type GroupBucket = {groupID: string | null; tasks: GroupTask[]};

// Groups in their order (the board order of categories).
export function orderedGroups(groups: EventChallengeGroup[]): EventChallengeGroup[] {
    return [...groups].sort((a, b) => a.Order - b.Order || a.Name.localeCompare(b.Name));
}

// The participant board's order inside a group: the manage page's order
// (BoardOrder), then unordered tasks by set attach time and set order.
export function compareGroupTasks(a: GroupTask, b: GroupTask): number {
    const left = a.challenge.BoardOrder ?? Number.MAX_SAFE_INTEGER;
    const right = b.challenge.BoardOrder ?? Number.MAX_SAFE_INTEGER;
    return left - right
        || a.attachment.CreatedAt.localeCompare(b.attachment.CreatedAt)
        || a.challenge.Order - b.challenge.Order
        || a.challenge.ID.localeCompare(b.challenge.ID);
}

// Every group's tasks across all active sets, plus the «Без групи» bucket.
// A task whose group no longer exists falls into «Без групи».
export function groupBuckets(groups: EventChallengeGroup[], sets: BoardSet[]): GroupBucket[] {
    const known = new Set(groups.map(group => group.ID));
    const buckets = new Map<string | null, GroupTask[]>([...orderedGroups(groups).map(group => [group.ID, []] as [string, GroupTask[]]), [null, []]]);
    for (const {attachment, challenges} of sets) {
        for (const challenge of challenges) {
            const groupID = challenge.GroupID && known.has(challenge.GroupID) ? challenge.GroupID : null;
            buckets.get(groupID)!.push({challenge, attachment});
        }
    }
    return [...buckets].map(([groupID, tasks]) => ({groupID, tasks: tasks.sort(compareGroupTasks)}));
}

// The first non-empty line of a task description as plain text.
// Inline placeholders read as «[label]» chips instead of their raw keys.
export function descriptionFirstLine(description: unknown, placeholders: SnapshotPlaceholder[] = []): string {
    const text = typeof description === "string" ? description : richTextPlainText(description, placeholderChips(placeholders));
    return text.split("\n").map(line => line.trim()).find(Boolean) ?? "";
}
