"use client";

import {useEffect, useState} from "react";

const fallback = "#0091EA";

// ECharts needs a concrete color: the theme-aware accent is read from its variable once mounted and again when the theme switches.
export function useEventAccent(): string {
    const [accent, setAccent] = useState(fallback);
    useEffect(() => {
        const read = () => {
            const value = getComputedStyle(document.documentElement).getPropertyValue("--ib-accent").trim();
            if (value) setAccent(value);
        };
        read();
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
        return () => observer.disconnect();
    }, []);
    return accent;
}
