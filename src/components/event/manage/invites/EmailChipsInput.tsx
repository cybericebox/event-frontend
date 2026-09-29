"use client";

import {useRef, useState, type ClipboardEvent, type KeyboardEvent} from "react";
import {X} from "lucide-react";
import {t} from "@/i18n/t";
import {addChips, addressSeparator, chipName, splitAddresses, type EmailChip} from "./emailChips";
import "./invites.css";

// Gmail-style address input: typing a separator or pasting turns addresses
// into chips; repeats are skipped; invalid ones stay as red chips; Backspace
// in the empty input removes the last chip.
export function EmailChipsInput({id, chips, onChange, disabled = false, placeholder, describedBy, required = false}: {
    id: string;
    chips: EmailChip[];
    onChange: (chips: EmailChip[]) => void;
    disabled?: boolean;
    placeholder?: string;
    describedBy?: string;
    required?: boolean;
}) {
    const [draft, setDraft] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const invalid = chips.some(chip => !chip.valid);

    function commit(text: string) {
        const addresses = splitAddresses(text);
        if (addresses.length) onChange(addChips(chips, addresses.map(email => ({email}))));
    }

    function change(value: string) {
        const parts = value.split(addressSeparator);
        if (parts.length > 1) {
            commit(parts.slice(0, -1).join(" "));
            setDraft(parts[parts.length - 1]);
        } else setDraft(value);
    }

    function keyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Enter" && draft.trim()) {
            event.preventDefault();
            commit(draft);
            setDraft("");
        } else if (event.key === "Backspace" && !draft && chips.length) {
            event.preventDefault();
            onChange(chips.slice(0, -1));
        }
    }

    function paste(event: ClipboardEvent<HTMLInputElement>) {
        const text = event.clipboardData.getData("text");
        if (!addressSeparator.test(text)) return;
        event.preventDefault();
        commit(`${draft}${text}`);
        setDraft("");
    }

    function remove(email: string) {
        onChange(chips.filter(chip => chip.email !== email));
        input.current?.focus();
    }

    return <div className="ib-input event-chips" aria-invalid={invalid || undefined} aria-disabled={disabled || undefined} onClick={() => input.current?.focus()}>
        {chips.map(chip => {
            const name = chipName(chip);
            return <span key={chip.email} className={`ib-tag event-chip${chip.valid ? "" : " is-invalid"}`} title={chip.valid ? name || undefined : t("manage.invites.chips.invalidAddress", {email: chip.email})}>
                <span className="event-chip__text">{chip.email}</span>
                <button className="event-chip__remove" type="button" disabled={disabled} aria-label={t("manage.invites.chips.remove", {email: chip.email})} onClick={event => {event.stopPropagation(); remove(chip.email);}}><X aria-hidden="true" /></button>
            </span>;
        })}
        <input ref={input} id={id} className="event-chips__input" type="text" inputMode="email" autoComplete="off" value={draft} disabled={disabled}
            placeholder={chips.length ? "" : placeholder} aria-describedby={describedBy} aria-required={required || undefined} aria-invalid={invalid || undefined}
            onChange={event => change(event.target.value)} onKeyDown={keyDown} onPaste={paste} onBlur={() => {if (draft.trim()) {commit(draft); setDraft("");}}} />
    </div>;
}
