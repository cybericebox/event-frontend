"use client";

import {useState} from "react";
import {manageSetsOpenKey} from "@/utils/storageKeys";

const storageKey = manageSetsOpenKey;

function read(eventID: string): Record<string, boolean> {
    try {
        const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(storageKey(eventID));
        const value: unknown = raw ? JSON.parse(raw) : {};
        return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, boolean> : {};
    } catch {
        return {};
    }
}

// Each set's open/closed choice for this browser session; a set without a
// choice uses the default.
export function useSetOpenState(eventID: string) {
    const [choices, setChoices] = useState<Record<string, boolean>>(() => read(eventID));
    const isOpen = (setID: string, fallback: boolean) => choices[setID] ?? fallback;
    function toggle(setID: string, fallback: boolean) {
        const next = {...choices, [setID]: !(choices[setID] ?? fallback)};
        setChoices(next);
        try {window.sessionStorage.setItem(storageKey(eventID), JSON.stringify(next));} catch {/* storage unavailable: keep it in memory */}
    }
    return {isOpen, toggle};
}
