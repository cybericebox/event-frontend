"use client";

import {useMemo, useSyncExternalStore} from "react";
import {withChartTheme} from "./chartTheme";

// Chart options name colours as DS tokens («var(--ib-dim)»); the canvas cannot read CSS variables, so the chart
// components resolve them to real colours when they render and again whenever the theme or the event brand changes.

const TOKEN = /var\(--[a-z0-9-]+\)/i;
let version = 0;
let observer: MutationObserver | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    if (!observer && typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(() => {
            version++;
            listeners.forEach(item => item());
        });
        observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme", "style", "class"]});
    }
    return () => {
        listeners.delete(listener);
        if (!listeners.size) {
            observer?.disconnect();
            observer = null;
        }
    };
}

// «color-mix(...)» tokens come back from getComputedStyle in a form the canvas library may not parse, so anything that is
// not plain rgb is repainted on a 1px canvas and read back.
function toRgb(color: string): string {
    if (/^rgba?\(/i.test(color) || color.startsWith("#")) return color;
    try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d");
        if (!context) return color;
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        return `rgba(${r},${g},${b},${+(a / 255).toFixed(3)})`;
    } catch {
        return color;
    }
}

export function resolveToken(value: string): string {
    if (typeof document === "undefined" || !TOKEN.test(value)) return value;
    // The token's own value (a hex, or a color-mix of the event brand) is read from the root, then painted to plain rgb.
    const raw = value.replace(/var\((--[a-z0-9-]+)\)/gi, (match, name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || match);
    if (TOKEN.test(raw)) return value;
    const probe = document.createElement("span");
    probe.style.color = raw;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return toRgb(color || raw);
}

// A deep copy of the option with every «var(--token)» string replaced by its current colour.
export function resolveChartTokens<T>(option: T): T {
    const cache = new Map<string, string>();
    const walk = (value: unknown): unknown => {
        if (typeof value === "string") {
            if (!TOKEN.test(value)) return value;
            if (!cache.has(value)) cache.set(value, resolveToken(value));
            return cache.get(value);
        }
        if (Array.isArray(value)) return value.map(walk);
        if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
        }
        return value;
    };
    return walk(option) as T;
}

export function useChartTokens<T>(option: T): T {
    const current = useSyncExternalStore(subscribe, () => version, () => 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `current` is the theme version that invalidates the colours
    return useMemo(() => resolveChartTokens(withChartTheme(option)), [option, current]);
}
