"use client";

import {useEffect, useState} from "react";
import QRCode from "qrcode";
import {t} from "@/i18n/t";

// Site paths such as /register are not scannable on their own: resolve them
// against the event site the live screen is served from. Anything else (a
// URL or plain text) is encoded as it is.
export function absoluteLiveURL(value: string, origin: string): string {
    if (!value) return "";
    if (!value.startsWith("/") || value.startsWith("//")) return value;
    try { return new URL(value, origin).href; } catch { return value; }
}

// The code is always dark on a white tile with a 4-module quiet zone, so it
// scans on both themes; the caption goes under it.
export function LiveQR({value, caption}: {value: string; caption: string}) {
    const [code, setCode] = useState({target: "", image: ""});
    useEffect(() => {
        let active = true;
        if (!value) return;
        const target = absoluteLiveURL(value.trim(), window.location.origin);
        void QRCode.toDataURL(target, {width: 512, margin: 4, errorCorrectionLevel: "M", color: {dark: "#16152B", light: "#FFFFFFFF"}})
            .then(image => {if (active) setCode({target, image});})
            .catch(() => {if (active) setCode({target, image: ""});});
        return () => {active = false;};
    }, [value]);
    return <div className="live-qr">
        {value && code.image ? <img src={code.image} alt={t("live.qr.alt", {url: code.target || value})} /> : <strong>{t("live.qr.empty")}</strong>}
        {caption.trim() && <span>{caption.trim()}</span>}
    </div>;
}
