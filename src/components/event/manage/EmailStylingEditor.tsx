"use client";

import type {ManageEmailTemplateInput} from "@/api/manageEmailTemplates";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "./ManageFieldLabel";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventSelect} from "@/components/ui/EventSelect";

const colors = [
    {key: "text_color", titleKey: "manage.email.styling.textColor", token: "", fallback: "#333333"},
    {key: "heading_color", titleKey: "manage.email.styling.headingColor", token: "theme:brand", fallback: "#211A52"},
    {key: "cta_bg_color", titleKey: "manage.email.styling.ctaBgColor", token: "theme:accent", fallback: "#211A52"},
    {key: "cta_text_color", titleKey: "manage.email.styling.ctaTextColor", token: "theme:on_accent", fallback: "#FFFFFF"},
] as const;

// Number fields of the styling: [key, title, default, min, max, unit]. They are
// stored as strings with the unit ("14px", "1.5").
const basic = [
    ["cta_border_radius", "manage.email.styling.ctaRadius", "4px", 0, 50, "px"],
    ["cta_font_size", "manage.email.styling.ctaFontSize", "14px", 8, 48, "px"],
] as const;
const advanced = [
    ["text_font_size", "manage.email.styling.textFontSize", "14px", 8, 32, "px"],
    ["text_line_height", "manage.email.styling.textLineHeight", "1.5", 1, 3, ""],
    ["heading_line_height", "manage.email.styling.headingLineHeight", "1.3", 1, 3, ""],
    ["paragraph_bottom_margin", "manage.email.styling.paragraphSpacing", "12px", 0, 64, "px"],
    ["heading_top_margin", "manage.email.styling.headingTopSpacing", "16px", 0, 64, "px"],
    ["heading_bottom_margin", "manage.email.styling.headingBottomSpacing", "8px", 0, 64, "px"],
    ["cta_vertical_padding", "manage.email.styling.buttonVerticalPadding", "10px", 0, 48, "px"],
    ["cta_horizontal_padding", "manage.email.styling.buttonHorizontalPadding", "20px", 0, 80, "px"],
] as const;
const fonts = [
    {value: "sans-serif", label: "manage.email.styling.fontSans"},
    {value: "Arial, sans-serif", label: "Arial"},
    {value: "Georgia, serif", label: "Georgia"},
    {value: "Verdana, sans-serif", label: "Verdana"},
];

export function EmailStylingEditor({styling, onChange, disabled}: {
    styling: ManageEmailTemplateInput["Styling"];
    onChange: (styling: ManageEmailTemplateInput["Styling"]) => void;
    disabled: boolean;
}) {
    const change = (key: string, value: string) => onChange({...styling, [key]: value});
    const number = ([key, title, fallback, min, max, unit]: readonly [string, string, string, number, number, string]) => <div className="event-manage-field" key={key}>
        <ManageFieldLabel title={t(title)} help={t("manage.email.styling.numberHelp", {min, max, unit: unit || t("manage.email.styling.noUnit")})} htmlFor={`event-email-styling-${key}`} />
        <input className="event-manage-input" id={`event-email-styling-${key}`} type="number" min={min} max={max} step={unit ? 1 : 0.1} disabled={disabled} value={parseFloat(String(styling[key] ?? fallback))}
            onChange={event => change(key, `${event.target.value}${unit}`)} />
    </div>;
    return <details className="event-email-styling"><summary>{t("manage.email.styling.title")}</summary><p>{t("manage.email.styling.intro")}</p><div className="event-email-styling__grid">{colors.map(color => {
        const value = typeof styling[color.key] === "string" ? styling[color.key] as string : color.token || color.fallback;
        const automatic = !!color.token && value === color.token;
        const hex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : color.fallback;
        return <div className="event-email-styling__field" key={color.key}><ManageFieldLabel title={t(color.titleKey)} help={t(color.token ? "manage.email.styling.autoHelp" : "manage.email.styling.textHelp")} /><div className="event-email-styling__control"><input type="color" aria-label={t("manage.email.styling.colorLabel", {name: t(color.titleKey)})} value={hex} disabled={disabled || automatic} onChange={event => change(color.key, event.target.value)} /><span>{automatic ? t("manage.email.styling.eventColor") : hex.toUpperCase()}</span></div>{color.token && <EventSwitch className="event-manage-form__switch" checked={automatic} disabled={disabled} onCheckedChange={checked => change(color.key, checked ? color.token : hex)} label={t("manage.email.styling.auto")} />}</div>;
    })}{basic.map(number)}</div>
        <details className="event-email-styling__advanced"><summary>{t("manage.email.styling.advanced")}</summary><div className="event-email-styling__grid">
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.email.styling.fontFamily")} help={t("manage.email.styling.fontFamilyHelp")} /><EventSelect ariaLabel={t("manage.email.styling.fontFamily")} disabled={disabled} value={String(styling.font_family ?? "sans-serif")} options={fonts.map(font => ({value: font.value, label: font.label.includes(".") ? t(font.label) : font.label}))} onValueChange={value => change("font_family", value)} /></div>
            {advanced.map(number)}
        </div></details></details>;
}
