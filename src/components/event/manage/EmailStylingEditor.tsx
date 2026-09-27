"use client";

import type {ManageEmailTemplateInput} from "@/api/manageEmailTemplates";
import {ManageFieldLabel} from "./ManageFieldLabel";

const colors = [
    {key: "text_color", title: "Основний текст", token: "", fallback: "#333333"},
    {key: "heading_color", title: "Заголовки", token: "theme:brand", fallback: "#211A52"},
    {key: "cta_bg_color", title: "Кнопка", token: "theme:accent", fallback: "#211A52"},
    {key: "cta_text_color", title: "Текст кнопки", token: "theme:on_accent", fallback: "#FFFFFF"},
] as const;

export function EmailStylingEditor({styling, onChange, disabled}: {
    styling: ManageEmailTemplateInput["Styling"];
    onChange: (styling: ManageEmailTemplateInput["Styling"]) => void;
    disabled: boolean;
}) {
    const change = (key: string, value: string) => onChange({...styling, [key]: value});
    return <details className="event-email-styling"><summary>Оформлення листа</summary><p>Кольори події автоматично підставляються в опублікований лист. За потреби можна вибрати власні кольори.</p><div className="event-email-styling__grid">{colors.map(color => {
        const value = typeof styling[color.key] === "string" ? styling[color.key] as string : color.token || color.fallback;
        const automatic = !!color.token && value === color.token;
        const hex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : color.fallback;
        return <div className="event-email-styling__field" key={color.key}><ManageFieldLabel title={color.title} help={color.token ? "Автоматичний колір береться з оформлення події. Власний колір використовуватиметься лише в цьому листі." : "Колір основного тексту листа."} /><div className="event-email-styling__control"><input type="color" aria-label={`Колір: ${color.title}`} value={hex} disabled={disabled || automatic} onChange={event => change(color.key, event.target.value)} /><span>{automatic ? "Колір події" : hex.toUpperCase()}</span></div>{color.token && <label className="event-manage-form__switch"><input type="checkbox" checked={automatic} disabled={disabled} onChange={event => change(color.key, event.target.checked ? color.token : hex)} />Автоматично</label>}</div>;
    })}</div></details>;
}
