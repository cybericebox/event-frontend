"use client";

import {useRef, type KeyboardEvent, type ReactNode} from "react";

export type ManageTab<T extends string> = {value: T; label: string; count?: ReactNode};

export const manageTabID = (idPrefix: string, value: string) => `${idPrefix}-tab-${value}`;
export const manageTabPanelID = (idPrefix: string) => `${idPrefix}-panel`;

// The DS underline tabs (`ib-tabs`): roving tabindex, ←/→ and Home/End move focus and select, every tab
// controls the one panel next to the list (`role="tabpanel"` with `manageTabPanelID`, labelled by `manageTabID`).
export function ManageTabs<T extends string>({idPrefix, label, tabs, value, onChange}: {
    idPrefix: string;
    label: string;
    tabs: ManageTab<T>[];
    value: T;
    onChange: (value: T) => void;
}) {
    const list = useRef<HTMLDivElement>(null);
    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const index = tabs.findIndex(tab => tab.value === value);
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
            : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault();
        onChange(tabs[next].value);
        list.current?.querySelector<HTMLElement>(`[id="${manageTabID(idPrefix, tabs[next].value)}"]`)?.focus();
    }
    return <div ref={list} className="ib-tabs ib-tabs--page ib-tabs--scroll" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map(tab => <button key={tab.value} id={manageTabID(idPrefix, tab.value)} type="button" role="tab" aria-selected={tab.value === value} aria-controls={manageTabPanelID(idPrefix)} tabIndex={tab.value === value ? 0 : -1} onClick={() => onChange(tab.value)}>
            {tab.label}{tab.count !== undefined && <span className="ib-num">{tab.count}</span>}
        </button>)}
    </div>;
}
