"use client";

import {useId, useRef, useState} from "react";
import {toast} from "react-hot-toast";
import {GripVertical, Moon, X} from "lucide-react";
import {imageUploadMessage} from "@/api/apiErrors";
import {liveLogoAccept, liveLogoMaxBytes, uploadLiveLogo} from "@/api/manageLive";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventFilePicker} from "@/components/ui/EventFilePicker";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {Sortable, useSortableItem} from "@/components/ui/Sortable";
import {liveLogoURL} from "../liveLayout";
import type {LiveLogoItem} from "../LiveCanvas";

const maxLogos = 32;

function LogoRow({item, index, disabled, busy, onDark, onClearDark, onRemove}: {
    item: LiveLogoItem & {key: string}; index: number; disabled: boolean; busy: boolean;
    onDark: () => void; onClearDark: () => void; onRemove: () => void;
}) {
    const sortable = useSortableItem(item.key, disabled);
    const src = liveLogoURL(item.src);
    const dark = item.dark ? liveLogoURL(item.dark) : null;
    const name = t("manage.live.logos.file", {number: index + 1});
    return <li className={`event-live-logo-row${sortable.dragging ? " is-dragging" : ""}`} {...sortable.itemProps}>
        <EventTooltip content={t("manage.live.logos.move")} silent>{() => <button className="event-live-logo-row__grip" type="button" aria-label={t("manage.live.logos.moveNamed", {name})} disabled={disabled} {...sortable.handleProps}><GripVertical size={16} /></button>}</EventTooltip>
        <span className="event-live-logo-row__preview is-light">{src && <img src={src} alt="" />}</span>
        <span className="event-live-logo-row__preview is-dark">{(dark ?? src) && <img src={dark ?? src!} alt="" />}</span>
        <span className="event-live-logo-row__name">{name}{item.dark && <small>{t("manage.live.logos.hasDark")}</small>}</span>
        {item.dark
            ? <EventTooltip content={t("manage.live.logos.clearDark")} silent>{() => <button type="button" aria-label={t("manage.live.logos.clearDarkNamed", {name})} disabled={disabled || busy} onClick={onClearDark}><Moon size={14} /><X size={10} /></button>}</EventTooltip>
            : <EventTooltip content={t("manage.live.logos.addDark")} silent>{() => <button type="button" aria-label={t("manage.live.logos.addDarkNamed", {name})} disabled={disabled || busy} onClick={onDark}><Moon size={14} /></button>}</EventTooltip>}
        <EventTooltip content={t("manage.live.logos.remove")} silent>{() => <button type="button" aria-label={t("manage.live.logos.removeNamed", {name})} disabled={disabled} onClick={onRemove}><X size={14} /></button>}</EventTooltip>
    </li>;
}

// Logos of an organizers or partners block: uploaded files only (SVG, PNG,
// WebP), reordered with the shared Sortable, each with an optional file for
// the dark theme.
export function LiveLogosEditor({eventID, items, disabled, onChange}: {eventID: string; items: LiveLogoItem[]; disabled: boolean; onChange: (items: LiveLogoItem[]) => void}) {
    const pickerID = useId();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const darkFor = useRef<number | null>(null);
    const darkInput = useRef<HTMLInputElement>(null);
    // Keys follow the file, so they survive reordering; the same file twice
    // still gets its own row.
    const seen = new Map<string, number>();
    const keyed = items.map(item => {
        const count = seen.get(item.src) ?? 0;
        seen.set(item.src, count + 1);
        return {...item, key: `${item.src}#${count}`};
    });

    async function upload(file: File): Promise<string | null> {
        setBusy(true);
        setError(null);
        try {return await uploadLiveLogo(eventID, file);}
        catch (failure) {const text = imageUploadMessage(failure, t("manage.live.logos.uploadError")); setError(text); toast.error(text); return null;}
        finally {setBusy(false);}
    }
    async function add(file: File | null) {
        if (!file || items.length >= maxLogos) return;
        const src = await upload(file);
        if (src) onChange([...items, {src}]);
    }
    async function addDark(files: FileList | null) {
        const index = darkFor.current;
        const file = files?.[0];
        if (darkInput.current) darkInput.current.value = "";
        if (index === null || !file) return;
        const dark = await upload(file);
        if (dark) onChange(items.map((item, other) => other === index ? {...item, dark} : item));
    }
    function move(from: number, to: number) {
        const next = [...items];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onChange(next);
    }
    return <div className="event-live-field event-live-logos-editor">
        <ManageFieldLabel title={t("manage.live.logos.title")} help={t("manage.live.logos.help")} htmlFor={pickerID} />
        {items.length ? <Sortable ids={keyed.map(item => item.key)} itemName={key => t("manage.live.logos.file", {number: keyed.findIndex(item => item.key === key) + 1})} onMove={move}>
            <ul className="event-live-logo-list">{keyed.map((item, index) => <LogoRow key={item.key} item={item} index={index} disabled={disabled} busy={busy}
                onDark={() => {darkFor.current = index; darkInput.current?.click();}}
                onClearDark={() => onChange(items.map((other, position) => position === index ? {src: other.src} : other))}
                onRemove={() => onChange(items.filter((_, position) => position !== index))} />)}</ul>
        </Sortable> : <EmptyState compact message={t("manage.live.logos.empty")} />}
        <EventFilePicker id={pickerID} fileName={null} accept={liveLogoAccept} maxBytes={liveLogoMaxBytes} busy={busy} disabled={disabled || items.length >= maxLogos}
            prompt={t("manage.live.logos.pickerPrompt")} label={t("manage.live.logos.pickerLabel")} hint={t("manage.live.logos.pickerHint")} error={error} onFile={file => void add(file)} />
        <input ref={darkInput} type="file" accept={liveLogoAccept} hidden onChange={event => void addDark(event.target.files)} />
    </div>;
}
