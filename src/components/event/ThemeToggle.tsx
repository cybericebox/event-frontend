"use client";

import {useEffect, useRef, useState, type KeyboardEvent} from "react";
import {ChevronDown, Monitor, Moon, Sun} from "lucide-react";
import {readThemeChoice, setThemeChoice, watchSystemTheme, type ThemeChoice} from "@/utils/theme";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

const choices: {value: ThemeChoice; label: string; icon: typeof Sun}[] = [
    {value: "light", label: "theme.light", icon: Sun},
    {value: "dark", label: "theme.dark", icon: Moon},
    {value: "system", label: "theme.system", icon: Monitor},
];

export function ThemeToggle({compact = false}: {compact?: boolean}) {
    const [choice, setChoice] = useState<ThemeChoice>("system");
    const current = useRef(choice);
    const disclosure = useRef<HTMLDetailsElement>(null);
    const trigger = useRef<HTMLElement>(null);
    useEffect(() => {
        const saved = readThemeChoice();
        current.current = saved;
        const frame = requestAnimationFrame(() => setChoice(saved));
        const stopWatching = watchSystemTheme(() => current.current);
        const sync = (event: Event) => {
            const next = (event as CustomEvent<ThemeChoice>).detail;
            current.current = next;
            setChoice(next);
        };
        window.addEventListener("ib-theme-change", sync);
        return () => { cancelAnimationFrame(frame); stopWatching(); window.removeEventListener("ib-theme-change", sync); };
    }, []);

    const select = (next: ThemeChoice) => {
        current.current = next;
        setChoice(next);
        setThemeChoice(next);
    };

    // Radio group with a roving tab stop: one Tab stop, arrows move and select.
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (compact && event.key === "ArrowLeft") return;
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = choices[(index + step + choices.length) % choices.length];
        select(next.value);
        (event.currentTarget.closest("[role=radiogroup]")?.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
    };

    const group = <div className={`event-theme-toggle${compact ? " event-theme-toggle--menu" : ""}`} role="radiogroup" aria-label={t("theme.label")} onKeyDown={event => {
        if (compact && event.key === "ArrowLeft") {
            event.preventDefault();
            event.stopPropagation();
            if (disclosure.current) disclosure.current.open = false;
            trigger.current?.focus();
        }
    }}>
        {choices.map(({value, label, icon: Icon}, index) => <EventTooltip key={value} content={t(label)} silent>{() => <button type="button" role="radio" data-value={value}
            aria-checked={choice === value} aria-label={t(label)} tabIndex={choice === value ? 0 : -1} onClick={() => select(value)} onKeyDown={event => onKeyDown(event, index)}>
            <Icon size={16} aria-hidden="true" />{compact && <span>{t(label)}</span>}
        </button>}</EventTooltip>)}
    </div>;
    if (!compact) return group;
    const selected = choices.find(item => item.value === choice)!;
    const Icon = selected.icon;
    return <details ref={disclosure} className="event-account__theme">
        <summary ref={trigger} onKeyDown={event => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                if (disclosure.current) disclosure.current.open = event.key === "ArrowRight";
            }
        }}><Icon size={16} aria-hidden="true" /><span>{t("theme.menuLabel")}</span><small>{t(`theme.current.${choice}`)}</small><ChevronDown size={16} aria-hidden="true" /></summary>
        {group}
    </details>;
}
