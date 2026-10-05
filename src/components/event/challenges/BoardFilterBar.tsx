"use client";

import type {BoardStage} from "@/api/participantChallenges";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {UNSTAGED, type BoardFilters, type BoardStatus} from "./challengeBoardModel";

// The board filters that belong to the page: «Активні» / «Всі», the stage (only when the event has stages) and the status.
// The category chips and the search stay in the boards themselves.
export function BoardFilterBar({filters, stages, hasUnstaged, onChange}: {filters: BoardFilters; stages: BoardStage[]; hasUnstaged: boolean; onChange: (filters: BoardFilters) => void}) {
    const stageOptions = [
        {value: "", label: t("challenges.filter.stage.all")},
        ...(hasUnstaged ? [{value: UNSTAGED, label: t("challenges.filter.stage.none")}] : []),
        ...stages.map(stage => ({value: stage.ID, label: stage.Name})),
    ];
    const statusOptions: {value: BoardStatus; label: string}[] = [
        {value: "", label: t("challenges.filter.status.all")},
        {value: "open", label: t("challenges.filter.status.open")},
        {value: "solved", label: t("challenges.filter.status.solved")},
        {value: "closed", label: t("challenges.filter.status.closed")},
    ];
    return <div className="event-board-filters" role="group" aria-label={t("challenges.filter.aria")}>
        <div className="ib-seg" role="group" aria-label={t("challenges.filter.scope")}>
            {([["active", "challenges.filter.scope.active"], ["all", "challenges.filter.scope.all"]] as const).map(([value, label]) =>
                <button key={value} type="button" aria-pressed={filters.scope === value} onClick={() => onChange({...filters, scope: value})}>{t(label)}</button>)}
        </div>
        {stages.length > 0 && <EventSelect className="event-board-filters__select" ariaLabel={t("challenges.filter.stage")} value={filters.stage} options={stageOptions} onValueChange={stage => onChange({...filters, stage})} />}
        <EventSelect className="event-board-filters__select" ariaLabel={t("challenges.filter.status")} value={filters.status} options={statusOptions} onValueChange={status => onChange({...filters, status: status as BoardStatus})} />
    </div>;
}
