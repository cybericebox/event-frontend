"use client";

import {useEffect, useState} from "react";

const pad = (value: number) => String(value).padStart(2, "0");

export type CountdownDisplay = "segments" | "compact" | "tiles";

export function CountdownValue({target, display = "segments"}: {target: string | null; display?: CountdownDisplay}) {
    const [now, setNow] = useState(0);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setNow(Date.now()));
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => { cancelAnimationFrame(frame); window.clearInterval(timer); };
    }, []);
    const deadline = target ? Date.parse(target) : NaN;
    if (display !== "compact") {
        const remaining = Number.isFinite(deadline) && now > 0 ? Math.max(0, Math.floor((deadline - now) / 1000)) : null;
        const days = remaining === null ? 0 : Math.floor(remaining / 86400);
        const parts = [
            ...(days > 0 ? [{value: String(days), label: "днів"}] : []),
            {value: remaining === null ? "—" : pad(Math.floor((remaining % 86400) / 3600)), label: "годин"},
            {value: remaining === null ? "—" : pad(Math.floor((remaining % 3600) / 60)), label: "хвилин"},
            {value: remaining === null ? "—" : pad(remaining % 60), label: "секунд"},
        ];
        return <div className={`ib-timer ib-timer--segments${display === "tiles" ? " ib-timer--tiles" : ""}`} role="timer" aria-label={remaining === null ? "Дату відліку ще не визначено" : remaining === 0 ? "Час настав" : parts.map(part => `${part.value} ${part.label}`).join(", ")} aria-live="off">
            <div className="ib-timer__parts" aria-hidden="true">{parts.map(part => <div className="ib-timer__part" key={part.label}><strong>{part.value}</strong><span>{part.label}</span></div>)}</div>
            {remaining === null && <span className="ib-timer__meta">Дату ще не визначено</span>}
            {remaining === 0 && <span className="ib-timer__meta">Час настав</span>}
        </div>;
    }
    if (!Number.isFinite(deadline)) return <p className="ib-timer__meta">Дату ще не визначено</p>;
    if (now === 0) return <div className="ib-timer ib-timer--compact" role="timer" aria-label="Завантажуємо відлік">—</div>;
    const seconds = Math.max(0, Math.floor((deadline - now) / 1000));
    if (seconds === 0) return <p className="ib-timer__meta">Час настав</p>;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return <div className="ib-timer ib-timer--compact" role="timer" aria-live="off" aria-label={`${days} днів, ${hours} годин, ${minutes} хвилин, ${seconds % 60} секунд`}>
        <span className="ib-timer__value">{days ? `${days} дн. ` : ""}{pad(hours)}:{pad(minutes)}:{pad(seconds % 60)}</span>
    </div>;
}
