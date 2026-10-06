"use client";

import type {BoardStage} from "@/api/participantChallenges";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {UNSTAGED, type BoardFilters, type BoardStatus} from "./challengeBoardModel";

// The board filters that belong to the page: the status segments and the stage (only when the event has stages).
// The category chips and the search stay in the boards themselves.
export function BoardFilterBar({filters, stages, hasUnstaged, onChange}: {filters: BoardFilters; stages: BoardStage[]; hasUnstaged: boolean; onChange: (filters: BoardFilters) => void}) {
    const stageOptions = [
        {value: "", label: t("challenges.filter.stage.all")},
        ...(hasUnstaged ? [{value: UNSTAGED, label: t("challenges.filter.stage.none")}] : []),
        ...stages.map(stage => ({value: stage.ID, label: stage.Name})),
    ];
    const statusOptions: {value: BoardStatus; label: string}[] = [
        {value: "open", label: t("challenges.filter.status.open")},
        {value: "solved", label: t("challenges.filter.status.solved")},
        {value: "closed", label: t("challenges.filter.status.closed")},
        {value: "", label: t("challenges.filter.status.all")},
    ];
    return <div className="event-board-filters" role="group" aria-label={t("challenges.filter.aria")}>
        <div className="ib-seg" role="group" aria-label={t("challenges.filter.status")}>
            {statusOptions.map(option =>
                <button key={option.value} type="button" aria-pressed={filters.status === option.value} onClick={() => onChange({...filters, status: option.value})}>{option.label}</button>)}
        </div>
        {stages.length > 0 && <EventSelect className="event-board-filters__select" ariaLabel={t("challenges.filter.stage")} value={filters.stage} options={stageOptions} onValueChange={stage => onChange({...filters, stage})} />}
    </div>;
}
