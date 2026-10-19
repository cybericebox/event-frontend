"use client";

import {useId} from "react";
import type {ContentBlock} from "@/types/eventContent";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {t} from "@/i18n/t";
import {blockLayoutProblems} from "./blockLayoutValidation";

type Props = {block: ContentBlock; disabled: boolean; errors?: Record<string, string>; onUpdate: (block: ContentBlock) => void};

export function BlockLayoutControls({block, disabled, errors, onUpdate}: Props) {
    const id = useId();
    const problems = {...Object.fromEntries(blockLayoutProblems(block).map(issue => [issue.field, issue.message])), ...errors};
    const hasErrors = Object.keys(problems).some(field => field.startsWith("spacing.") || ["maxWidth", "contentAlign", "textColumns", "mobileFullWidth"].includes(field));
    function numeric(field: string, label: string, value: number | undefined, onChange: (value: number | undefined) => void, width = false) {
        const error = problems[field];
        const errorId = `${id}-${field}-error`;
        return <label className="event-manage-field" key={field}><span>{label}</span>
            <input className="event-manage-input" type="number" min={width ? 320 : 0} max={width ? 1920 : 160} step={1} value={value ?? ""} placeholder={t("manage.blocks.layoutSettings.inherit")} disabled={disabled} aria-label={label} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} onChange={event => onChange(event.target.value === "" ? undefined : Number(event.target.value))} />
            {error && <span id={errorId} className="event-content-editor__field-error" role="alert">{error}</span>}
        </label>;
    }
    function fieldProps(field: string) {
        return {role: "group", "aria-invalid": !!problems[field], "aria-describedby": problems[field] ? `${id}-${field}-error` : undefined};
    }
    function fieldError(field: string) {
        return problems[field] ? <span id={`${id}-${field}-error`} className="event-content-editor__field-error" role="alert">{problems[field]}</span> : null;
    }
    function updateSpacing(device: "desktop" | "mobile", side: "top" | "bottom" | "inline", value: number | undefined) {
        const nextDevice = {...block.spacing?.[device], [side]: value};
        const spacing = {...block.spacing, [device]: Object.values(nextDevice).some(v => v !== undefined) ? nextDevice : undefined};
        onUpdate({...block, spacing: Object.values(spacing).some(v => v !== undefined) ? spacing : undefined});
    }
    return <details className="event-block-layout" open={hasErrors || undefined}>
        <summary>{t("manage.blocks.layoutSettings.title")}</summary>
        <p className="event-content-editor__hint">{t("manage.blocks.layoutSettings.help")}</p>
        {(["desktop", "mobile"] as const).map(device => <fieldset key={device} disabled={disabled} className="event-block-layout__device">
            <legend>{t(`manage.blocks.layoutSettings.${device}`)}</legend>
            <div className="event-block-layout__fields">{(["top", "bottom", "inline"] as const).map(side => numeric(`spacing.${device}.${side}`, t(`manage.blocks.layoutSettings.${device}.${side}`), block.spacing?.[device]?.[side], value => updateSpacing(device, side, value)))}</div>
        </fieldset>)}
        <div className="event-block-layout__fields">
            {numeric("maxWidth", t("manage.blocks.layoutSettings.maxWidth"), block.maxWidth, value => onUpdate({...block, maxWidth: value}), true)}
            <div className="event-manage-field" {...fieldProps("contentAlign")} aria-label={t("manage.blocks.layoutSettings.align")}><span>{t("manage.blocks.layoutSettings.align")}</span><EventSelect ariaLabel={t("manage.blocks.layoutSettings.align")} disabled={disabled} value={block.contentAlign ?? "default"} options={[{value: "default", label: t("manage.blocks.layoutSettings.inherit")}, {value: "start", label: t("manage.blocks.align.left")}, {value: "center", label: t("manage.blocks.align.center")}, {value: "end", label: t("manage.blocks.align.right")}]} onValueChange={value => onUpdate({...block, contentAlign: value === "default" ? undefined : value as ContentBlock["contentAlign"]})} />{fieldError("contentAlign")}</div>
        </div>
        {block.type === "text" && <div className="event-manage-field" {...fieldProps("textColumns")} aria-label={t("manage.blocks.layoutSettings.columns")}><span>{t("manage.blocks.layoutSettings.columns")}</span><EventSelect ariaLabel={t("manage.blocks.layoutSettings.columns")} disabled={disabled} value={String(block.textColumns ?? 1)} options={[{value: "1", label: t("manage.blocks.layoutSettings.oneColumn")}, {value: "2", label: t("manage.blocks.layoutSettings.twoColumns")}]} onValueChange={value => onUpdate({...block, textColumns: value === "2" ? 2 : undefined})} /><small className="event-content-editor__hint">{t("manage.blocks.layoutSettings.columnsHelp")}</small>{fieldError("textColumns")}</div>}
        {block.type === "banner" && <div className="event-manage-field"><EventSwitch disabled={disabled} checked={block.mobileFullWidth ?? false} onCheckedChange={value => onUpdate({...block, mobileFullWidth: value || undefined})} label={t("manage.blocks.layoutSettings.mobileFullWidth")} /><small className="event-content-editor__hint">{t("manage.blocks.layoutSettings.bannerHelp")}</small></div>}
    </details>;
}
