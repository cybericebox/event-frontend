"use client";

import {CircleHelp, RotateCcw} from "lucide-react";
import {signalGroups, signalLabel, type ManageNotificationSubscription} from "@/api/manageNotifications";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

// The left column of a notification page: signals by group, each row with the
// plain on/off switch of sending it for this event. A required signal (the
// invitation) is always on and its switch is locked.
export function SignalList({signals, rows, selected, canManage, busy, ariaLabel, onSelect, onToggle}: {
    signals: string[];
    rows: ManageNotificationSubscription[];
    selected: string;
    canManage: boolean;
    busy: boolean;
    ariaLabel: string;
    onSelect: (signal: string) => void;
    onToggle: (signal: string, enabled: boolean) => void;
}) {
    return <nav className="event-manage-section event-manage-notifications__list" aria-label={ariaLabel}>
        {signalGroups(signals).map(({group, signals: items}) => <div className="event-manage-notifications__group" key={group}>
            <h2>{group}</h2>
            {items.map(item => {
                const row = rows.find(entry => entry.SignalType === item);
                const title = signalLabel(item).title;
                return <div className={`event-manage-notifications__item${selected === item ? " is-selected" : ""}`} key={item}>
                    <button className="event-manage-notifications__pick" type="button" aria-current={selected === item ? "true" : undefined} onClick={() => onSelect(item)}>{title}</button>
                    <EventSwitch checked={!!row?.Enabled} disabled={!canManage || busy || !row || row.Required} ariaLabel={t("manage.notifications.switchLabel", {title})} onCheckedChange={checked => onToggle(item, checked)} />
                </div>;
            })}
        </div>)}
    </nav>;
}

// The header of the selected signal: its name and description on the left, the
// on/off switch of sending with a (?) help and, when the event overrides the
// platform default, a reset.
export function SignalHead({signal, row, canManage, busy, help, requiredHelp, onToggle, onReset}: {
    signal: string;
    row: ManageNotificationSubscription | undefined;
    canManage: boolean;
    busy: boolean;
    help: string;
    requiredHelp: string;
    onToggle: (enabled: boolean) => void;
    onReset: () => void;
}) {
    const label = signalLabel(signal);
    return <div className="event-manage-notifications__signal-head">
        <div className="event-manage-section__head"><h2>{label.title}</h2>{label.description && <p>{label.description}</p>}</div>
        {row && <div className="event-manage-notifications__delivery-actions">
            <EventTooltip content={<span className="event-brand-tooltip-copy">{row.Required ? requiredHelp : help}</span>}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title: label.title})} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip>
            <EventSwitch checked={row.Enabled} disabled={!canManage || busy || row.Required} ariaLabel={t("manage.notifications.switchHeadLabel")} onCheckedChange={onToggle} />
            {row.Source === "event" && !row.Required && canManage && <EventTooltip content={t("manage.notifications.resetTitle")}>{id => <button className="ib-btn ib-btn--sm" type="button" disabled={busy} aria-describedby={id} onClick={onReset}><RotateCcw size={15} /> {t("manage.notifications.reset")}</button>}</EventTooltip>}
        </div>}
    </div>;
}
