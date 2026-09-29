"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {MoreHorizontal, type LucideIcon} from "lucide-react";

export type ActionMenuItem = {
    key: string; label: string; icon: LucideIcon;
    onSelect?: () => void; href?: string;
    // A disabled item shows why under its label.
    disabledReason?: string;
    // Danger items (removing) come last, after a separator.
    danger?: boolean;
};

// «⋯» with every action of a row: icon + label items in a portal sized to
// its labels (the card never clips it). Hidden when there is nothing to do.
export function ActionMenu({label, items, disabled = false}: {label: string; items: ActionMenuItem[]; disabled?: boolean}) {
    if (items.length === 0) return null;
    const regular = items.filter(item => !item.danger);
    const danger = items.filter(item => item.danger);
    const render = (item: ActionMenuItem) => {
        const content = <><item.icon size={16} aria-hidden="true" /><span className="event-action-menu__text"><span>{item.label}</span>{item.disabledReason && <small>{item.disabledReason}</small>}</span></>;
        const className = `ib-listbox__opt event-action-menu__item${item.danger ? " is-danger" : ""}`;
        if (item.href && !item.disabledReason) return <DropdownMenu.Item key={item.key} className={className} asChild><a href={item.href}>{content}</a></DropdownMenu.Item>;
        return <DropdownMenu.Item key={item.key} className={className} disabled={!!item.disabledReason} onSelect={() => item.onSelect?.()}>{content}</DropdownMenu.Item>;
    };
    return <DropdownMenu.Root>
        <DropdownMenu.Trigger className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={label} disabled={disabled}><MoreHorizontal size={16} aria-hidden="true" /></DropdownMenu.Trigger>
        <DropdownMenu.Portal><DropdownMenu.Content className="ib-listbox event-action-menu" sideOffset={4} align="end" collisionPadding={12}>
            {regular.map(render)}
            {regular.length > 0 && danger.length > 0 && <DropdownMenu.Separator className="event-action-menu__separator" />}
            {danger.map(render)}
        </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>;
}
