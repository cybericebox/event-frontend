"use client";

import {useEffect, useState} from "react";
import {Moon, Sun} from "lucide-react";

export function ThemeToggle({onMass = false}: {onMass?: boolean}) {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const selected = window.localStorage.getItem("event-theme") === "dark";
        document.documentElement.dataset.theme = selected ? "dark" : "light";
        setDark(selected);
    }, []);
    const toggle = () => {
        const next = !dark;
        document.documentElement.dataset.theme = next ? "dark" : "light";
        window.localStorage.setItem("event-theme", next ? "dark" : "light");
        setDark(next);
    };
    return <button className={onMass ? "event-theme-toggle event-theme-toggle--mass" : "event-theme-toggle"} type="button" aria-label={dark ? "Увімкнути світлу тему" : "Увімкнути темну тему"} onClick={toggle}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>;
}
