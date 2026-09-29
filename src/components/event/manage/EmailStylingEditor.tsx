"use client";

import type {ManageEmailTemplateInput} from "@/api/manageEmailTemplates";
import {t} from "@/i18n/t";
import {EventSelect} from "@/components/ui/EventSelect";
import {ManageFieldLabel} from "./ManageFieldLabel";
import {ColorPicker} from "./notifications/editor/ColorPicker";
import type {BrandColors} from "./notifications/editor/emailBlocks";

// The colours are picked with the admin colour picker; `theme:*` tokens follow the event brand.
const colors = [
    {key: "cta_bg_color", title: "manage.tpl.editor.ctaBackground", fallback: "theme:accent"},
    {key: "cta_text_color", title: "manage.tpl.editor.ctaText", fallback: "theme:on_accent"},
    {key: "text_color", title: "manage.tpl.editor.textColor", fallback: "#333333"},
    {key: "heading_color", title: "manage.tpl.editor.headingColor", fallback: "theme:brand"},
] as const;

// Number fields of the styling: [key, title, default, min, max, unit]. They are
// stored as strings with the unit ("14px", "1.5").
const basic = [
    ["cta_border_radius", "manage.tpl.editor.ctaBorderRadius", "4px", 0, 50, "px"],
    ["cta_font_size", "manage.tpl.editor.ctaFontSize", "14px", 8, 48, "px"],
] as const;
const advanced = [
    ["text_font_size", "manage.tpl.editor.textFontSize", "14px", 8, 32, "px"],
    ["text_line_height", "manage.tpl.editor.textLineHeight", "1.5", 1, 3, ""],
    ["heading_line_height", "manage.tpl.editor.headingLineHeight", "1.3", 1, 3, ""],
    ["paragraph_bottom_margin", "manage.tpl.editor.paragraphSpacing", "12px", 0, 64, "px"],
    ["heading_top_margin", "manage.tpl.editor.headingTopSpacing", "16px", 0, 64, "px"],
    ["heading_bottom_margin", "manage.tpl.editor.headingBottomSpacing", "8px", 0, 64, "px"],
    ["cta_vertical_padding", "manage.tpl.editor.buttonVerticalPadding", "10px", 0, 48, "px"],
    ["cta_horizontal_padding", "manage.tpl.editor.buttonHorizontalPadding", "20px", 0, 80, "px"],
] as const;
const fonts = [
    {value: "sans-serif", label: "manage.tpl.editor.fontSansSerif"},
    {value: "Arial, sans-serif", label: "Arial"},
    {value: "Georgia, serif", label: "Georgia"},
    {value: "Verdana, sans-serif", label: "Verdana"},
];

export function EmailStylingEditor({styling, onChange, disabled, brand}: {
    styling: ManageEmailTemplateInput["Styling"];
    onChange: (styling: ManageEmailTemplateInput["Styling"]) => void;
    disabled: boolean;
    brand: BrandColors;
}) {
    const change = (key: string, value: string) => onChange({...styling, [key]: value});
    const number = ([key, title, fallback, min, max, unit]: readonly [string, string, string, number, number, string]) => <div className="event-manage-field" key={key}>
        <ManageFieldLabel title={t(title)} help={t("manage.email.styling.numberHelp", {min, max, unit: unit || t("manage.email.styling.noUnit")})} htmlFor={`event-email-styling-${key}`} />
        <input className="event-manage-input" id={`event-email-styling-${key}`} type="number" min={min} max={max} step={unit ? 1 : 0.1} disabled={disabled} value={parseFloat(String(styling[key] ?? fallback))}
            onChange={event => change(key, `${event.target.value}${unit}`)} />
    </div>;
    return <section className="event-email-styling">
        <ManageFieldLabel title={t("manage.tpl.tpl.styling")} help={t("manage.tpl.editor.advancedStylingHelp")} />
        <div className={`event-email-styling__grid${disabled ? " opacity-60" : ""}`} {...(disabled ? {inert: true} : {})}>
            {colors.map(color => <ColorPicker key={color.key} label={t(color.title)} help={t("manage.email.styling.colorHelp")} brand={brand}
                value={typeof styling[color.key] === "string" ? styling[color.key] as string : color.fallback} onChange={value => change(color.key, value)} />)}
            {basic.map(number)}
        </div>
        <details className="event-email-styling__advanced"><summary>{t("manage.tpl.editor.advancedStyling")}</summary><div className="event-email-styling__grid">
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.tpl.editor.fontFamily")} help={t("manage.email.styling.fontFamilyHelp")} /><EventSelect ariaLabel={t("manage.tpl.editor.fontFamily")} disabled={disabled} value={String(styling.font_family ?? "sans-serif")} options={fonts.map(font => ({value: font.value, label: font.label.includes(".") ? t(font.label) : font.label}))} onValueChange={value => change("font_family", value)} /></div>
            {advanced.map(number)}
        </div></details>
    </section>;
}
