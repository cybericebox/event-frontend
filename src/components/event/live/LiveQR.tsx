"use client";

import {useEffect, useState} from "react";
import QRCode from "qrcode";

export function LiveQR({url}: {url: string}) {
    const [image, setImage] = useState("");
    useEffect(() => {
        let active = true;
        if (!url) return;
        void QRCode.toDataURL(url, {width: 512, margin: 1, errorCorrectionLevel: "M", color: {dark: "#16152B", light: "#FFFFFFFF"}})
            .then(value => {if (active) setImage(value);})
            .catch(() => {if (active) setImage("");});
        return () => {active = false;};
    }, [url]);
    return <div className="live-qr">{image ? <img src={image} alt={`QR-код для ${url}`} /> : <strong>Додайте посилання для QR-коду</strong>}<span>{url}</span></div>;
}
