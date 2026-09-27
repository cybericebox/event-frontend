"use client";

import {useEffect, useState, type CSSProperties} from "react";

const pad = (value: number) => String(value).padStart(2, "0");
const unit = (value: number, one: string, few: string, many: string) => value % 10 === 1 && value % 100 !== 11 ? one : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 12 || value % 100 > 14) ? few : many;

export type CountdownDisplay = "segments" | "compact" | "tiles" | "focus" | "dial" | "ledger" | "poster" | "tracks" | "flip";

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
            ...(days > 0 ? [{value: String(days), label: unit(days, "день", "дні", "днів")}] : []),
            {value: remaining === null ? "—" : pad(Math.floor((remaining % 86400) / 3600)), label: unit(remaining === null ? 0 : Math.floor((remaining % 86400) / 3600), "година", "години", "годин")},
            {value: remaining === null ? "—" : pad(Math.floor((remaining % 3600) / 60)), label: unit(remaining === null ? 0 : Math.floor((remaining % 3600) / 60), "хвилина", "хвилини", "хвилин")},
            {value: remaining === null ? "—" : pad(remaining % 60), label: unit(remaining === null ? 0 : remaining % 60, "секунда", "секунди", "секунд")},
        ];
        const ariaLabel = remaining === null ? "Дату відліку ще не визначено" : remaining === 0 ? "Час настав" : parts.map(part => `${part.value} ${part.label}`).join(", ");
        const meta = remaining === null ? "Дату ще не визначено" : remaining === 0 ? "Час настав" : "";
        if (display === "focus") {
            const [main, ...rest] = parts;
            return <div className="ib-timer ib-timer--focus" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__focus-main" aria-hidden="true"><strong>{main.value}</strong><span>{main.label}</span></div><div className="ib-timer__focus-rest" aria-hidden="true">{rest.map(part => <span key={part.label}><strong>{part.value}</strong> {part.label}</span>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        }
        if (display === "dial") {
            const seconds = parts[parts.length - 1];
            const progress = remaining === null ? 0 : (remaining % 60) / 60 * 100;
            return <div className="ib-timer ib-timer--dial" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__dial-face" style={{"--ib-timer-progress": `${progress}%`} as CSSProperties} aria-hidden="true"><strong>{seconds.value}</strong><span>{seconds.label}</span></div><div className="ib-timer__dial-rest" aria-hidden="true">{parts.slice(0, -1).map(part => <span key={part.label}><strong>{part.value}</strong><small>{part.label}</small></span>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        }
        if (display === "ledger") return <div className="ib-timer ib-timer--ledger" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__ledger-rows" aria-hidden="true">{parts.map(part => <div key={part.label}><span>{part.label}</span><strong>{part.value}</strong></div>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        if (display === "poster") {
            const [lead, ...rest] = parts;
            return <div className="ib-timer ib-timer--poster" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__poster-lead" aria-hidden="true"><span>{lead.label}</span><strong>{lead.value}</strong></div><div className="ib-timer__poster-rest" aria-hidden="true">{rest.map(part => <span key={part.label}><strong>{part.value}</strong><small>{part.label}</small></span>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        }
        if (display === "tracks") {
            const daysPart = days > 0 ? parts[0] : null;
            const trackParts = daysPart ? parts.slice(1) : parts;
            return <div className="ib-timer ib-timer--tracks" role="timer" aria-label={ariaLabel} aria-live="off">{daysPart && <p className="ib-timer__tracks-days" aria-hidden="true"><strong>{daysPart.value}</strong> {daysPart.label}</p>}<div className="ib-timer__tracks-list" aria-hidden="true">{trackParts.map((part, index) => <div className="ib-timer__tracks-row" key={part.label}><span>{part.label}</span><div className="ib-timer__tracks-bar" style={{"--ib-track-progress": `${remaining === null ? 0 : Number(part.value) / (index === 0 ? 24 : 60) * 100}%`} as CSSProperties} /><strong>{part.value}</strong></div>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        }
        if (display === "flip") return <div className="ib-timer ib-timer--flip" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__flip-parts" aria-hidden="true">{parts.map(part => <div className="ib-timer__flip-part" key={part.label}><strong>{part.value}</strong><span>{part.label}</span></div>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        return <div className={`ib-timer ib-timer--segments${display === "tiles" ? " ib-timer--tiles" : ""}`} role="timer" aria-label={ariaLabel} aria-live="off">
            <div className="ib-timer__parts" aria-hidden="true">{parts.map(part => <div className="ib-timer__part" key={part.label}><strong>{part.value}</strong><span>{part.label}</span></div>)}</div>
            {meta && <span className="ib-timer__meta">{meta}</span>}
        </div>;
    }
    if (!Number.isFinite(deadline)) return <p className="ib-timer__meta">Дату ще не визначено</p>;
    if (now === 0) return <div className="ib-timer ib-timer--compact" role="timer" aria-label="Завантажуємо відлік">—</div>;
    const seconds = Math.max(0, Math.floor((deadline - now) / 1000));
    if (seconds === 0) return <p className="ib-timer__meta">Час настав</p>;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return <div className="ib-timer ib-timer--compact" role="timer" aria-live="off" aria-label={`${days} ${unit(days, "день", "дні", "днів")}, ${hours} ${unit(hours, "година", "години", "годин")}, ${minutes} ${unit(minutes, "хвилина", "хвилини", "хвилин")}, ${seconds % 60} ${unit(seconds % 60, "секунда", "секунди", "секунд")}`}>
        <span className="ib-timer__value">{days ? `${days} дн. ` : ""}{pad(hours)}:{pad(minutes)}:{pad(seconds % 60)}</span>
    </div>;
}
