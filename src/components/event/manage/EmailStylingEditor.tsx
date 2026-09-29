"use client";

import type {ManageEmailTemplateInput} from "@/api/manageEmailTemplates";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "./ManageFieldLabel";

const colors = [
    {key: "text_color", titleKey: "manage.email.styling.textColor", token: "", fallback: "#333333"},
    {key: "heading_color", titleKey: "manage.email.styling.headingColor", token: "theme:brand", fallback: "#211A52"},
    {key: "cta_bg_color", titleKey: "manage.email.styling.ctaBgColor", token: "theme:accent", fallback: "#211A52"},
    {key: "cta_text_color", titleKey: "manage.email.styling.ctaTextColor", token: "theme:on_accent", fallback: "#FFFFFF"},
] as const;

export function EmailStylingEditor({styling, onChange, disabled}: {
    styling: ManageEmailTemplateInput["Styling"];
    onChange: (styling: ManageEmailTemplateInput["Styling"]) => void;
    disabled: boolean;
}) {
    const change = (key: string, value: string) => onChange({...styling, [key]: value});
    return <details className="event-email-styling"><summary>{t("manage.email.styling.title")}</summary><p>{t("manage.email.styling.intro")}</p><div className="event-email-styling__grid">{colors.map(color => {
        const value = typeof styling[color.key] === "string" ? styling[color.key] as string : color.token || color.fallback;
        const automatic = !!color.token && value === color.token;
        const hex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : color.fallback;
        return <div className="event-email-styling__field" key={color.key}><ManageFieldLabel title={t(color.titleKey)} help={t(color.token ? "manage.email.styling.autoHelp" : "manage.email.styling.textHelp")} /><div className="event-email-styling__control"><input type="color" aria-label={t("manage.email.styling.colorLabel", {name: t(color.titleKey)})} value={hex} disabled={disabled || automatic} onChange={event => change(color.key, event.target.value)} /><span>{automatic ? t("manage.email.styling.eventColor") : hex.toUpperCase()}</span></div>{color.token && <label className="event-manage-form__switch"><input type="checkbox" checked={automatic} disabled={disabled} onChange={event => change(color.key, event.target.checked ? color.token : hex)} />{t("manage.email.styling.auto")}</label>}</div>;
    })}</div></details>;
}
