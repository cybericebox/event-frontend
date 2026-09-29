"use client";

import {useRef, useState} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {ChevronDown, Circle} from "lucide-react";
import {t} from "@/i18n/t";

type Option = {value: string; label: string; disabled?: boolean; disabledReason?: string};

export function EventSelect({value, options, onValueChange, disabled = false, ariaLabel, placeholder = t("common.chooseValue"), className = ""}: {
    value: string; options: Option[]; onValueChange: (value: string) => void;
    disabled?: boolean; ariaLabel: string; placeholder?: string; className?: string;
}) {
    const selected = options.find(option => option.value === value);
    const triggerRef = useRef<HTMLButtonElement>(null);
    // Inside a native <dialog> (top layer) the menu must render in it, or it opens behind the dialog.
    const [container, setContainer] = useState<HTMLElement | null>(null);
    return <DropdownMenu.Root onOpenChange={open => {if (open) setContainer(triggerRef.current?.closest("dialog") ?? null);}}>
        <DropdownMenu.Trigger ref={triggerRef} className={`event-select ib-select__trigger event-manage-input ${className}`} type="button" disabled={disabled} aria-label={ariaLabel}>
            <span className={selected ? "" : "ib-select__ph"}>{selected?.label ?? placeholder}</span><ChevronDown size={16} aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal container={container ?? undefined}><DropdownMenu.Content className={`ib-listbox event-select__menu${options.some(option => option.disabledReason) ? " event-select__menu--reasons" : ""}`} sideOffset={4} align="start" collisionPadding={8}>
            <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
                {options.map(option => option.disabled && option.disabledReason
                    ? <div className="event-select__unavailable" key={option.value} aria-label={`${option.label}. ${option.disabledReason}`}>
                        <DropdownMenu.RadioItem className="ib-listbox__opt event-select__option" value={option.value} disabled><DropdownMenu.ItemIndicator className="event-select__indicator"><Circle size={8} fill="currentColor" aria-hidden="true" /></DropdownMenu.ItemIndicator><span>{option.label}</span></DropdownMenu.RadioItem>
                        <small>{option.disabledReason}</small>
                    </div>
                    : <DropdownMenu.RadioItem className="ib-listbox__opt event-select__option" key={option.value} value={option.value} disabled={option.disabled}>
                        <DropdownMenu.ItemIndicator className="event-select__indicator"><Circle size={8} fill="currentColor" aria-hidden="true" /></DropdownMenu.ItemIndicator><span>{option.label}</span>
                    </DropdownMenu.RadioItem>)}
            </DropdownMenu.RadioGroup>
        </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>;
}
