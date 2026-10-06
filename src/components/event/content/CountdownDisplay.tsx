"use client";

import {useEffect, useState, type CSSProperties} from "react";
import {t, tPlural} from "@/i18n/t";

const pad = (value: number) => String(value).padStart(2, "0");
type Unit = "days" | "hours" | "minutes" | "seconds";
const unit = (value: number, name: Unit) => tPlural(`content.countdown.${name}`, value);

export type CountdownDisplay = "segments" | "compact" | "tiles" | "focus" | "dial" | "ledger" | "poster" | "tracks" | "flip" | "ticker" | "stairs" | "orbits" | "matrix" | "ribbon" | "rings";

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
            ...(days > 0 ? [{value: String(days), label: unit(days, "days")}] : []),
            {value: remaining === null ? "—" : pad(Math.floor((remaining % 86400) / 3600)), label: unit(remaining === null ? 0 : Math.floor((remaining % 86400) / 3600), "hours")},
            {value: remaining === null ? "—" : pad(Math.floor((remaining % 3600) / 60)), label: unit(remaining === null ? 0 : Math.floor((remaining % 3600) / 60), "minutes")},
            {value: remaining === null ? "—" : pad(remaining % 60), label: unit(remaining === null ? 0 : remaining % 60, "seconds")},
        ];
        const ariaLabel = remaining === null ? t("content.countdown.noTargetAria") : remaining === 0 ? t("content.countdown.reached") : parts.map(part => `${part.value} ${part.label}`).join(", ");
        const meta = remaining === null ? t("content.countdown.noTarget") : remaining === 0 ? t("content.countdown.reached") : "";
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
        if (display === "ticker") return <div className="ib-timer ib-timer--ticker" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__ticker-parts" aria-hidden="true">{parts.map(part => <div className="ib-timer__ticker-part" key={part.label}><span>{part.label}</span><strong>{part.value}</strong></div>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        if (display === "stairs") return <div className="ib-timer ib-timer--stairs" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__stairs-list" aria-hidden="true">{parts.map((part, index) => <div className="ib-timer__stairs-step" key={part.label} style={{"--ib-step": index} as CSSProperties}><strong>{part.value}</strong><span>{part.label}</span></div>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        if (display === "orbits") return <div className="ib-timer ib-timer--orbits" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__orbits-list" aria-hidden="true">{parts.map(part => <div className="ib-timer__orbits-unit" key={part.label}><strong>{part.value}</strong><span>{part.label}</span></div>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        if (display === "matrix") return <div className="ib-timer ib-timer--matrix" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__matrix-grid" aria-hidden="true">{parts.map(part => <div className="ib-timer__matrix-cell" key={part.label}><span>{part.label}</span><strong>{part.value}</strong></div>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        if (display === "ribbon") return <div className="ib-timer ib-timer--ribbon" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__ribbon-strip" aria-hidden="true">{parts.map(part => <div className="ib-timer__ribbon-unit" key={part.label}><strong>{part.value}</strong><span>{part.label}</span></div>)}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        if (display === "rings") return <div className="ib-timer ib-timer--rings" role="timer" aria-label={ariaLabel} aria-live="off"><div className="ib-timer__rings-list" aria-hidden="true">{parts.map((part, index) => {
            const maximum = days > 0 && index === 0 ? days : index === (days > 0 ? 1 : 0) ? 24 : 60;
            const progress = Math.max(0, Math.min(100, Number(part.value) / maximum * 100)) || 0;
            return <div className="ib-timer__rings-unit" key={part.label} style={{"--ib-ring-progress": `${progress}%`} as CSSProperties}><strong>{part.value}</strong><span>{part.label}</span></div>;
        })}</div>{meta && <span className="ib-timer__meta">{meta}</span>}</div>;
        return <div className={`ib-timer ib-timer--segments${display === "tiles" ? " ib-timer--tiles" : ""}`} role="timer" aria-label={ariaLabel} aria-live="off">
            <div className="ib-timer__parts" aria-hidden="true">{parts.map(part => <div className="ib-timer__part" key={part.label}><strong>{part.value}</strong><span>{part.label}</span></div>)}</div>
            {meta && <span className="ib-timer__meta">{meta}</span>}
        </div>;
    }
    if (!Number.isFinite(deadline)) return <p className="ib-timer__meta">{t("content.countdown.noTarget")}</p>;
    if (now === 0) return <div className="ib-timer ib-timer--compact" role="timer" aria-label={t("content.countdown.loading")}>—</div>;
    const seconds = Math.max(0, Math.floor((deadline - now) / 1000));
    if (seconds === 0) return <p className="ib-timer__meta">{t("content.countdown.reached")}</p>;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return <div className="ib-timer ib-timer--compact" role="timer" aria-live="off" aria-label={([[days, "days"], [hours, "hours"], [minutes, "minutes"], [seconds % 60, "seconds"]] as const).map(([value, name]) => `${value} ${unit(value, name)}`).join(", ")}>
        <span className="ib-timer__value">{days > 0 && <span className="ib-timer__compact-days">{t("content.countdown.daysShort", {days})}</span>}<span className="ib-timer__compact-clock">{pad(hours)}:{pad(minutes)}:{pad(seconds % 60)}</span></span>
    </div>;
}
