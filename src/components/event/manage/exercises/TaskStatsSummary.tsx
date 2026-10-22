"use client";

import {Network} from "lucide-react";
import type {ManageScoring} from "@/api/manage";
import type {EventChallengeGroup} from "@/api/manageChallenges";
import type {ManageStage} from "@/api/manageStages";
import {t, tPlural} from "@/i18n/t";
import {AnalyticsStat, AnalyticsStatGrid} from "../analytics/AnalyticsStat";
import {formatCount} from "../analytics/analyticsFormat";
import type {BoardSet} from "./challengeOrder";
import {taskStats, type StatBucket} from "./taskStatsModel";

function ChipRow<K>({label, buckets, name}: {label: string; buckets: StatBucket<K>[]; name: (key: K) => string}) {
    if (buckets.length === 0) return null;
    return <div className="event-task-stats__row" role="group" aria-label={label}>
        <span className="event-task-stats__row-label">{label}</span>
        <ul className="event-task-stats__chips">{buckets.map(bucket => {
            const text = t("manage.exercises.stats.chip", {name: name(bucket.key), count: formatCount(bucket.count)});
            return <li key={String(bucket.key)} className="ib-tag ib-tag--sm">{text}</li>;
        })}</ul>
    </div>;
}

// «Основні завдання»: the event-wide figures of its tasks, above the resource plan. It renders from the same board
// data as the sets (no loader of its own; a refetch keeps the previous figures) and stays hidden without sets.
export function TaskStatsSummary({sets, scoring, stages, groups}: {sets: BoardSet[]; scoring: ManageScoring; stages: ManageStage[]; groups: EventChallengeGroup[]}) {
    if (sets.length === 0) return null;
    const stageNames = new Map(stages.map(stage => [stage.ID, stage.Name]));
    const groupNames = new Map(groups.map(group => [group.ID, group.Name]));
    const stats = taskStats(sets, scoring, {
        stageOrder: stages.map(stage => stage.ID),
        groupOrder: [...groups].sort((a, b) => a.Order - b.Order).map(group => group.ID),
    });
    return <div className="event-task-stats">
        <AnalyticsStatGrid label={t("manage.exercises.stats.label")}>
            <AnalyticsStat label={t("manage.exercises.stats.tasks")} value={formatCount(stats.tasks)} hint={t("manage.exercises.stats.tasksHint")}
                note={t("manage.exercises.stats.tasksNote", {sets: tPlural("manage.exercises.stats.sets", stats.sets), published: formatCount(stats.published), hidden: formatCount(stats.hidden)})} />
            <AnalyticsStat label={t("manage.exercises.stats.maxPoints")} value={formatCount(stats.maxPoints)} hint={t("manage.exercises.stats.maxPointsHint")}
                note={t("manage.exercises.stats.maxPointsNote", {points: formatCount(stats.publishedMaxPoints)})} />
            {stats.withInfrastructure > 0 && <AnalyticsStat label={t("manage.exercises.stats.infrastructure")} value={formatCount(stats.withInfrastructure)}
                hint={t("manage.exercises.stats.infrastructureHint")} icon={<Network size={14} aria-hidden="true" />} />}
            <AnalyticsStat label={t("manage.exercises.stats.hints")} value={formatCount(stats.withHints)} hint={t("manage.exercises.stats.hintsHint")}
                note={t("manage.exercises.stats.hintsNote", {count: formatCount(stats.hints)})} />
        </AnalyticsStatGrid>
        <ChipRow label={t("manage.exercises.stats.byDifficulty")} buckets={stats.byDifficulty}
            name={key => key === null ? t("manage.exercises.stats.difficultyNone") : t(`manage.exercises.difficulty.${key}`)} />
        <ChipRow label={t("manage.exercises.stats.byCategory")} buckets={stats.byCategory} name={key => key ?? t("manage.exercises.stats.categoryNone")} />
        {stages.length > 0 && <ChipRow label={t("manage.exercises.stats.byStage")} buckets={stats.byStage}
            name={key => (key !== null && stageNames.get(key)) || t("manage.exercises.stats.stageNone")} />}
        {groups.length > 0 && <ChipRow label={t("manage.exercises.stats.byGroup")} buckets={stats.byGroup}
            name={key => (key !== null && groupNames.get(key)) || t("manage.exercises.stats.groupNone")} />}
    </div>;
}
