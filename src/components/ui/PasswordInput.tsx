"use client";

import {useState, type InputHTMLAttributes} from "react";
import {t} from "@/i18n/t";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
    // Controlled reveal state, so a password + confirmation pair shows / hides together.
    shown?: boolean;
    onShownChange?: (shown: boolean) => void;
    // A write-only secret is never shown back, so it has no «Показати» button.
    writeOnly?: boolean;
};

// ds-v2 .ib-input-wrap--password: input + «Показати» / «Сховати» text button (as in id-frontend).
export function PasswordInput({className = "event-manage-input", shown: shownProp, onShownChange, writeOnly = false, ...props}: PasswordInputProps) {
    const [shownState, setShownState] = useState(false);
    const shown = shownProp ?? shownState;
    return <div className="ib-input-wrap ib-input-wrap--password">
        <input {...props} className={className} type={shown ? "text" : "password"} />
        {!props.disabled && !writeOnly && <button className="ib-input__reveal" type="button" aria-pressed={shown} onClick={() => {setShownState(!shown); onShownChange?.(!shown);}}>{shown ? t("common.hide") : t("common.show")}</button>}
    </div>;
}
