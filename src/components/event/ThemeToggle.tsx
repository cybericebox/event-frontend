"use client";

import {useEffect, useRef, useState} from "react";
import {Monitor, Moon, Sun} from "lucide-react";
import {readThemeChoice, setThemeChoice, watchSystemTheme, type ThemeChoice} from "@/utils/theme";
import {EventTooltip} from "@/components/ui/EventTooltip";

const choices: {value: ThemeChoice; label: string; icon: typeof Sun}[] = [
    {value: "light", label: "Світла тема", icon: Sun},
    {value: "dark", label: "Темна тема", icon: Moon},
    {value: "system", label: "Системна тема", icon: Monitor},
];

export function ThemeToggle() {
    const [choice, setChoice] = useState<ThemeChoice>("system");
    const current = useRef(choice);
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

    return <div className="event-theme-toggle" role="radiogroup" aria-label="Тема оформлення">
        {choices.map(({value, label, icon: Icon}) => <EventTooltip key={value} content={label}>{id => <button type="button" role="radio"
            aria-checked={choice === value} aria-label={label} aria-describedby={id} onClick={() => select(value)}>
            <Icon size={16} aria-hidden="true" />
        </button>}</EventTooltip>)}
    </div>;
}
