"use client";

import type {ReactNode} from "react";
import {ArrowDown, ArrowUp, GripVertical} from "lucide-react";
import {Sortable, useSortableItem} from "@/components/ui/Sortable";
import {moveItem} from "@/components/ui/sortableOrder";
import {t} from "@/i18n/t";
import {EventTooltip} from "@/components/ui/EventTooltip";

type RenderedItem = {content: ReactNode; actions?: ReactNode; selected?: boolean; onSelect?: () => void};

// A vertical list reordered by its grips (pointer or keyboard) and by up/down
// buttons. Each list is its own sortable, so items never move between lists.
export function SortableList<T>({items, itemID, itemName, disabled = false, onReorder, renderItem, className = "", ariaLabel}: {
    items: T[];
    itemID: (item: T) => string;
    itemName: (item: T) => string;
    disabled?: boolean;
    onReorder: (ids: string[]) => void;
    renderItem: (item: T, index: number) => RenderedItem;
    className?: string;
    ariaLabel: string;
}) {
    const ids = items.map(itemID);

    function move(from: number, to: number) {
        const next = moveItem(ids, from, to);
        if (next !== ids) onReorder(next);
    }

    return <Sortable ids={ids} itemName={id => itemName(items[ids.indexOf(id)])} onMove={move}>
        <ol className={`event-sortable ${className}`.trim()} aria-label={ariaLabel}>
            {items.map((item, index) => <SortableRow key={ids[index]} id={ids[index]} index={index} count={items.length} name={itemName(item)} disabled={disabled} move={move} {...renderItem(item, index)} />)}
        </ol>
    </Sortable>;
}

function SortableRow({id, index, count, name, disabled, move, content, actions, selected, onSelect}: RenderedItem & {
    id: string; index: number; count: number; name: string; disabled: boolean; move: (from: number, to: number) => void;
}) {
    const sortable = useSortableItem(id, disabled);
    return <li {...sortable.itemProps} className={`event-sortable__row${selected ? " is-selected" : ""}`}>
        <EventTooltip content={t("manage.challenges.order.drag")} silent>{() => <button type="button" className="event-sortable__grip" {...sortable.handleProps} aria-label={t("manage.challenges.order.dragNamed", {name})} disabled={disabled}><GripVertical size={16} aria-hidden="true" /></button>}</EventTooltip>
        {onSelect
            ? <button type="button" className="event-sortable__main" aria-pressed={!!selected} onClick={onSelect}>{content}</button>
            : <div className="event-sortable__main">{content}</div>}
        {/* ↑ ↓ first, then the row's own actions (edit, delete last). */}
        <div className="event-sortable__actions">
            <EventTooltip content={t("manage.exercises.groups.moveUp")} silent>{() => <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.challenges.order.moveUp", {name})} disabled={disabled || index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={16} aria-hidden="true" /></button>}</EventTooltip>
            <EventTooltip content={t("manage.exercises.groups.moveDown")} silent>{() => <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.challenges.order.moveDown", {name})} disabled={disabled || index === count - 1} onClick={() => move(index, index + 1)}><ArrowDown size={16} aria-hidden="true" /></button>}</EventTooltip>
            {actions}
        </div>
    </li>;
}
