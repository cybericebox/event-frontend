"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {Check, ChevronDown} from "lucide-react";

type Option = {value: string; label: string};

export function EventSelect({value, options, onValueChange, disabled = false, ariaLabel, placeholder = "Оберіть значення", className = ""}: {
    value: string; options: Option[]; onValueChange: (value: string) => void;
    disabled?: boolean; ariaLabel: string; placeholder?: string; className?: string;
}) {
    const selected = options.find(option => option.value === value);
    return <DropdownMenu.Root>
        <DropdownMenu.Trigger className={`event-select ib-select__trigger event-manage-input ${className}`} type="button" disabled={disabled} aria-label={ariaLabel}>
            <span className={selected ? "" : "ib-select__ph"}>{selected?.label ?? placeholder}</span><ChevronDown size={16} aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal><DropdownMenu.Content className="ib-listbox event-select__menu" sideOffset={4} align="start" collisionPadding={8}>
            <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
                {options.map(option => <DropdownMenu.RadioItem className="ib-listbox__opt" key={option.value} value={option.value}>
                    <span>{option.label}</span><Check size={16} aria-hidden="true" />
                </DropdownMenu.RadioItem>)}
            </DropdownMenu.RadioGroup>
        </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>;
}
