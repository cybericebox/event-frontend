"use client";

import {useState, type DragEvent, type ReactNode} from "react";
import {ArrowDown, ArrowUp, GripVertical} from "lucide-react";
import {moveItem} from "./challengeOrder";
import {t} from "@/i18n/t";

const dragMime = "application/x-cybericebox-order";

// A vertical list reordered by drag-and-drop (grip) and by up/down buttons.
// Drops are accepted only from the same list (`listID`): no dragging between lists.
export function SortableList<T>({listID, items, itemID, itemName, disabled = false, onReorder, renderItem, className = "", ariaLabel}: {
    listID: string;
    items: T[];
    itemID: (item: T) => string;
    itemName: (item: T) => string;
    disabled?: boolean;
    onReorder: (ids: string[]) => void;
    renderItem: (item: T, index: number) => {content: ReactNode; actions?: ReactNode; selected?: boolean; onSelect?: () => void};
    className?: string;
    ariaLabel: string;
}) {
    const [dragging, setDragging] = useState<number | null>(null);
    const [over, setOver] = useState<number | null>(null);
    const ids = items.map(itemID);

    function move(from: number, to: number) {
        const next = moveItem(ids, from, to);
        if (next !== ids) onReorder(next);
    }

    function dragStart(event: DragEvent<HTMLElement>, index: number) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(dragMime, `${listID}:${index}`);
        setDragging(index);
    }

    function dragOver(event: DragEvent<HTMLElement>, index: number) {
        if (dragging === null || disabled) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(index);
    }

    function drop(event: DragEvent<HTMLElement>, index: number) {
        const [source, from] = event.dataTransfer.getData(dragMime).split(":");
        event.preventDefault();
        setDragging(null);
        setOver(null);
        if (source !== listID || disabled) return;
        move(Number(from), index);
    }

    return <ol className={`event-sortable ${className}`.trim()} aria-label={ariaLabel}>
        {items.map((item, index) => {
            const {content, actions, selected, onSelect} = renderItem(item, index);
            const name = itemName(item);
            return <li key={ids[index]}
                className={`event-sortable__row${selected ? " is-selected" : ""}${dragging === index ? " is-dragging" : ""}${over === index && dragging !== index ? " is-over" : ""}`}
                onDragOver={event => dragOver(event, index)} onDragLeave={() => setOver(current => current === index ? null : current)} onDrop={event => drop(event, index)}>
                <span className="event-sortable__grip" draggable={!disabled} aria-hidden="true" title={t("manage.challenges.order.drag")}
                    onDragStart={event => dragStart(event, index)} onDragEnd={() => {setDragging(null); setOver(null);}}><GripVertical size={16} /></span>
                {onSelect
                    ? <button type="button" className="event-sortable__main" aria-pressed={!!selected} onClick={onSelect}>{content}</button>
                    : <div className="event-sortable__main">{content}</div>}
                <div className="event-sortable__actions">
                    {actions}
                    <button className="ib-icon-btn ib-icon-btn--sm" type="button" title={t("manage.exercises.groups.moveUp")} aria-label={t("manage.challenges.order.moveUp", {name})} disabled={disabled || index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={16} aria-hidden="true" /></button>
                    <button className="ib-icon-btn ib-icon-btn--sm" type="button" title={t("manage.exercises.groups.moveDown")} aria-label={t("manage.challenges.order.moveDown", {name})} disabled={disabled || index === items.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={16} aria-hidden="true" /></button>
                </div>
            </li>;
        })}
    </ol>;
}
