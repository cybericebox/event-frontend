import type {ManageScoring} from "@/api/manage";
import type {EventBoardChallenge} from "@/api/manageChallenges";
import {difficultyOrder} from "../analytics/tasks/tasksModel";
import type {BoardSet} from "./challengeOrder";

export type Difficulty = (typeof difficultyOrder)[number];
// A bucket of a chip row: its key (null = «Не вказана» / «Без категорії» / the whole event / «Без групи») and how many tasks.
export type StatBucket<K> = {key: K; count: number};

export type TaskStats = {
    sets: number;
    tasks: number;
    published: number;
    hidden: number;
    maxPoints: number;
    publishedMaxPoints: number;
    withInfrastructure: number;
    withHints: number;
    hints: number;
    byDifficulty: StatBucket<Difficulty | null>[];
    byCategory: StatBucket<string | null>[];
    byStage: StatBucket<string | null>[];
    byGroup: StatBucket<string | null>[];
};

type Scoring = Pick<ManageScoring, "Mode" | "MaxPoints" | "ForceEventScoring">;

/**
 * The most a task can award, as the daemon resolves it: the event's profile when the event forces its scoring or the
 * task has no override (ResolveScoringProfile), else the task's own; a static profile awards EffectivePoints (the
 * server's EffectiveStaticPoints), a dynamic one starts at its MaxPoints.
 */
export function taskTopPoints(challenge: Pick<EventBoardChallenge, "EffectivePoints" | "ScoringOverride">, scoring: Scoring): number {
    const profile = scoring.ForceEventScoring || !challenge.ScoringOverride ? scoring : challenge.ScoringOverride;
    return profile.Mode === 0 ? challenge.EffectivePoints : profile.MaxPoints;
}

const isDifficulty = (value: string | undefined): value is Difficulty => (difficultyOrder as readonly string[]).includes(value ?? "");

// Counts keyed in first-seen order; the unknown bucket (null) last.
function tally<K>(keys: (K | null)[], order?: readonly K[]): StatBucket<K | null>[] {
    const counts = new Map<K | null, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    const known = order ? order.filter(key => counts.has(key)) : [...counts.keys()].filter((key): key is K => key !== null);
    const out: StatBucket<K | null>[] = known.map(key => ({key, count: counts.get(key)!}));
    if (counts.has(null)) out.push({key: null, count: counts.get(null)!});
    return out;
}

/**
 * The event-wide figures of «Основні завдання», from the same board data the sets render. Tasks are the sets'
 * board challenges (subtasks). A task counts under every category of its set; categories are sorted by count, then
 * by name. Stages and groups follow the given order (unknown ids are left out), the «none» bucket last.
 */
export function taskStats(sets: BoardSet[], scoring: Scoring, {stageOrder = [], groupOrder = []}: {stageOrder?: string[]; groupOrder?: string[]} = {}): TaskStats {
    const stats: TaskStats = {
        sets: sets.length, tasks: 0, published: 0, hidden: 0, maxPoints: 0, publishedMaxPoints: 0, withInfrastructure: 0, withHints: 0, hints: 0,
        byDifficulty: [], byCategory: [], byStage: [], byGroup: [],
    };
    const difficulties: (Difficulty | null)[] = [];
    const categories: (string | null)[] = [];
    const stages: (string | null)[] = [];
    const groups: (string | null)[] = [];
    for (const {attachment, challenges} of sets) {
        const tags = [...new Set((attachment.Tags ?? []).map(tag => tag.trim()).filter(Boolean))];
        for (const challenge of challenges) {
            stats.tasks += 1;
            const top = taskTopPoints(challenge, scoring);
            stats.maxPoints += top;
            if (challenge.Published) {stats.published += 1; stats.publishedMaxPoints += top;} else stats.hidden += 1;
            if (attachment.Infrastructure) stats.withInfrastructure += 1;
            if (challenge.Hints.length > 0) {stats.withHints += 1; stats.hints += challenge.Hints.length;}
            difficulties.push(isDifficulty(challenge.Snapshot.difficulty) ? challenge.Snapshot.difficulty : null);
            if (tags.length === 0) categories.push(null); else categories.push(...tags);
            stages.push(attachment.StageID !== null && stageOrder.includes(attachment.StageID) ? attachment.StageID : null);
            groups.push(challenge.GroupID !== null && groupOrder.includes(challenge.GroupID) ? challenge.GroupID : null);
        }
    }
    stats.byDifficulty = tally(difficulties, difficultyOrder);
    const byCategory = tally(categories);
    const named = byCategory.filter(bucket => bucket.key !== null).sort((a, b) => b.count - a.count || a.key!.localeCompare(b.key!, "uk"));
    stats.byCategory = [...named, ...byCategory.filter(bucket => bucket.key === null)];
    stats.byStage = tally(stages, stageOrder);
    stats.byGroup = tally(groups, groupOrder);
    return stats;
}
