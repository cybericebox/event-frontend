"use client";

import {useEffect, useState} from "react";
import QRCode from "qrcode";
import {t} from "@/i18n/t";

// Site paths such as /register are not scannable on their own: resolve them
// against the event site the live screen is served from.
export function absoluteLiveURL(url: string, origin: string): string {
    if (!url) return "";
    try { return new URL(url, origin).href; } catch { return url; }
}

export function LiveQR({url}: {url: string}) {
    const [code, setCode] = useState({target: "", image: ""});
    useEffect(() => {
        let active = true;
        if (!url) return;
        const target = absoluteLiveURL(url, window.location.origin);
        void QRCode.toDataURL(target, {width: 512, margin: 1, errorCorrectionLevel: "M", color: {dark: "#16152B", light: "#FFFFFFFF"}})
            .then(value => {if (active) setCode({target, image: value});})
            .catch(() => {if (active) setCode({target, image: ""});});
        return () => {active = false;};
    }, [url]);
    const shown = url ? code.target || url : "";
    return <div className="live-qr">{url && code.image ? <img src={code.image} alt={t("live.qr.alt", {url: shown})} /> : <strong>{t("live.qr.empty")}</strong>}<span>{shown}</span></div>;
}
