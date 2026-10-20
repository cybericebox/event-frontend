"use client";

import {useId, useRef, type ReactNode, type SyntheticEvent} from "react";
import {t, tPlural} from "@/i18n/t";

const LEVELS = ["elementary", "trivial", "easy", "medium", "hard", "insane"] as const;
const ONE_DECIMAL = new Intl.NumberFormat("uk", {minimumFractionDigits: 1, maximumFractionDigits: 1});

/** The level an average rounds to (half up, like the catalog filter). */
export function averageLevel(average: number): (typeof LEVELS)[number] {
    return LEVELS[Math.min(6, Math.max(1, Math.floor(average + 0.5))) - 1];
}

/** «Легка 3,3»: the level and the number, as in the task catalog; «—» without a difficulty. */
export function AverageDifficulty({average}: {average: number | null}) {
    if (average === null) return <span className="event-catalog-stat__none" aria-label={t("manage.exercises.avgDifficulty.none")}>—</span>;
    const level = t(`manage.exercises.avgDifficulty.${averageLevel(average)}`);
    const value = ONE_DECIMAL.format(average);
    return <span className="event-catalog-stat__difficulty" aria-label={t("manage.exercises.avgDifficulty.value", {level, value})}>
        <span aria-hidden="true">{level}</span> <span aria-hidden="true" className="event-catalog-stat__number">{value}</span>
    </span>;
}

/**
 * A trigger that opens a small panel on click, tap, Enter or Space. A native popover: it shares the dialog's top
 * layer (never clipped by the list's scroll), closes on Esc or a press outside, and the browser keeps aria-expanded on
 * the button. The click never reaches the row (it never toggles a set).
 */
export function InfoPopover({label, title, trigger, triggerClassName = "event-subtask-count__trigger", children}: {
    label: string; title: string; trigger: ReactNode; triggerClassName?: string; children: ReactNode;
}) {
    const id = useId();
    const button = useRef<HTMLButtonElement>(null);
    function place(event: SyntheticEvent<HTMLDivElement>) {
        const panel = event.currentTarget;
        if (!button.current || !panel.matches(":popover-open")) return;
        const rect = button.current.getBoundingClientRect();
        const box = panel.getBoundingClientRect();
        const below = rect.bottom + 6 + box.height <= window.innerHeight - 12;
        panel.style.left = `${Math.max(12, Math.min(window.innerWidth - box.width - 12, rect.left))}px`;
        panel.style.top = `${below ? rect.bottom + 6 : Math.max(12, rect.top - box.height - 6)}px`;
    }
    return <span className="event-subtask-count">
        <button ref={button} type="button" className={triggerClassName} popoverTarget={id} aria-haspopup="dialog" aria-label={label} onClick={event => event.stopPropagation()}>{trigger}</button>
        <div id={id} popover="auto" role="dialog" aria-label={title} className="event-subtask-count__panel" onToggle={place}>
            <p className="event-subtask-count__title">{title}</p>
            {children}
        </div>
    </span>;
}

/** The subtask count; it opens the subtask names. `labelled` writes «3 підзавдання» instead of the bare number. */
export function SubtaskCount({count, names, labelled = false}: {count: number | null; names: string[]; labelled?: boolean}) {
    if (count === null) return <span className="event-catalog-stat__none" aria-label={t("manage.exercises.subtasks.none")}>—</span>;
    return <InfoPopover label={t("manage.exercises.subtasks.show", {count})} title={t("manage.exercises.subtasks.title")} trigger={labelled ? tPlural("manage.exercises.subtasks.count", count) : count}>
        {names.length === 0
            ? <p className="event-subtask-count__empty">{t("manage.exercises.subtasks.empty")}</p>
            : <ol className="event-subtask-count__list">{names.map((name, index) => <li key={`${index}-${name}`}>{name || t("manage.exercises.subtasks.unnamed")}</li>)}</ol>}
    </InfoPopover>;
}

/** «Середня складність» and «Підзавдання» side by side, as in «Додати з каталогу» and the event's task list. */
export function CatalogStatsList({average, count, names, className = ""}: {average: number | null; count: number | null; names: string[]; className?: string}) {
    return <dl className={`event-catalog-stats${className ? ` ${className}` : ""}`}>
        <div><dt>{t("manage.exercises.attachDialog.avgDifficulty")}</dt><dd><AverageDifficulty average={average} /></dd></div>
        <div><dt>{t("manage.exercises.attachDialog.subtasks")}</dt><dd><SubtaskCount count={count} names={names} /></dd></div>
    </dl>;
}
