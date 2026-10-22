"use client";

import {useId, useRef, useState, type ReactNode} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {Check, ChevronDown} from "lucide-react";
import {t} from "@/i18n/t";

// `hint` is shown beside the option in the list only (a count), never on the trigger.
export type MultiOption = {value: string; label: string; hint?: string};

// A select with several choices, in the look of EventSelect: the trigger says
// what is chosen («Складність: Легка, Середня», or the empty label), the menu
// lists the options with checks and stays open while picking. With `onSearch`
// the menu starts with a search field (long lists, server suggestions);
// `state` fills the list area while the options load or fail.
export function EventMultiSelect({ariaLabel, label, emptyLabel, options, value, onChange, onSearch, state, className = "", disabled = false}: {
    ariaLabel: string;
    // The name before the chosen labels on the trigger, and the trigger text when nothing is chosen.
    label: string; emptyLabel: string;
    options: MultiOption[]; value: string[]; onChange: (value: string[]) => void;
    onSearch?: (query: string) => void;
    // Loading or failure of the options, shown inside the menu instead of the list.
    state?: ReactNode;
    className?: string; disabled?: boolean;
}) {
    const [query, setQuery] = useState("");
    const searchID = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const chosen = value.map(item => options.find(option => option.value === item)?.label ?? item);
    const summary = chosen.length === 0 ? emptyLabel : chosen.length <= 2 ? `${label}: ${chosen.join(", ")}` : `${label}: ${chosen.slice(0, 2).join(", ")} +${chosen.length - 2}`;
    // Chosen values the current search does not return stay listed, so they can be unchecked.
    const listed: MultiOption[] = [...options, ...value.filter(item => !options.some(option => option.value === item)).map(item => ({value: item, label: item}))];
    const toggle = (item: string) => onChange(value.includes(item) ? value.filter(entry => entry !== item) : [...value, item]);
    return <DropdownMenu.Root onOpenChange={open => {if (open) setContainer(triggerRef.current?.closest("dialog") ?? null);}}>
        <DropdownMenu.Trigger ref={triggerRef} className={`event-select ib-select__trigger event-manage-input event-multi-select${value.length ? " is-active" : ""} ${className}`} type="button" disabled={disabled} aria-label={`${ariaLabel}: ${value.length ? chosen.join(", ") : emptyLabel}`}>
            <span>{summary}</span><ChevronDown size={16} aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal container={container ?? undefined}><DropdownMenu.Content className="ib-listbox event-select__menu event-multi-select__menu" sideOffset={4} align="start" collisionPadding={8}>
            {onSearch && <div className="event-multi-select__search">
                <input id={searchID} className="event-manage-input" type="search" value={query} placeholder={t("common.search")} aria-label={t("common.search")} autoFocus
                    onChange={change => {setQuery(change.target.value); onSearch(change.target.value);}}
                    // Letters belong to the field, not to the menu's type-ahead.
                    onKeyDown={keyEvent => {if (keyEvent.key !== "Escape" && keyEvent.key !== "ArrowDown" && keyEvent.key !== "Tab") keyEvent.stopPropagation();}} />
            </div>}
            {state ?? <>
                {listed.length === 0 && <div className="event-select__empty" role="note">{t("common.noOptions")}</div>}
                {listed.map(option => <DropdownMenu.CheckboxItem key={option.value} className="ib-listbox__opt event-multi-select__option" checked={value.includes(option.value)}
                    onCheckedChange={() => toggle(option.value)} onSelect={selectEvent => selectEvent.preventDefault()}>
                    <span className="event-multi-select__check" aria-hidden="true"><DropdownMenu.ItemIndicator><Check size={14} /></DropdownMenu.ItemIndicator></span><span>{option.label}</span>{option.hint ? <small className="event-multi-select__hint">{option.hint}</small> : null}
                </DropdownMenu.CheckboxItem>)}
            </>}
            {value.length > 0 && <><DropdownMenu.Separator className="event-multi-select__separator" />
                <DropdownMenu.Item className="ib-listbox__opt event-multi-select__clear" onSelect={selectEvent => {selectEvent.preventDefault(); onChange([]);}}>{t("common.clearSelection")}</DropdownMenu.Item></>}
        </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>;
}
