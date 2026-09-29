"use client";

import {useState, type InputHTMLAttributes} from "react";
import {Eye, EyeOff} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

// Password field with an eye button on the right that reveals / hides the value.
export function PasswordInput({className = "event-manage-input", ...props}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
    const [shown, setShown] = useState(false);
    const label = shown ? t("common.hidePassword") : t("common.showPassword");
    return <div className="event-password">
        <input {...props} className={className} type={shown ? "text" : "password"} />
        {!props.disabled && <EventTooltip content={label}>{id => <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={label} aria-pressed={shown} aria-describedby={id} onClick={() => setShown(value => !value)}>{shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}</button>}</EventTooltip>}
    </div>;
}
