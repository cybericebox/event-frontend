"use client";

import {useEffect, useState} from "react";

const pad = (value: number) => String(value).padStart(2, "0");

export function CountdownValue({target}: {target: string | null}) {
    const [now, setNow] = useState(0);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setNow(Date.now()));
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => { cancelAnimationFrame(frame); window.clearInterval(timer); };
    }, []);
    const deadline = target ? Date.parse(target) : NaN;
    if (!Number.isFinite(deadline)) return <p className="ib-timer__meta">Дату ще не визначено</p>;
    if (now === 0) return <div className="ib-timer" role="timer" aria-label="Завантажуємо відлік">—</div>;
    const seconds = Math.max(0, Math.floor((deadline - now) / 1000));
    if (seconds === 0) return <p className="ib-timer__meta">Час настав</p>;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return <div className="ib-timer" role="timer" aria-live="off">
        <span className="ib-timer__value">{days ? `${days} дн. ` : ""}{pad(hours)}:{pad(minutes)}:{pad(seconds % 60)}</span>
    </div>;
}
