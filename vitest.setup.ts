import {configure} from "@testing-library/dom";

// jsdom has no matchMedia; components that read hover or motion
// preferences (e.g. EventTooltip) get a "matches nothing" stub. A real
// implementation is never replaced, and node-environment tests skip this.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {},
        dispatchEvent: () => false,
    })) as typeof window.matchMedia;
}

// findBy*/waitFor poll up to this long. The default 1 s is a wall-clock budget that a starved CPU
// exhausts before the first render of a heavy component finishes; a passing wait still returns at once.
configure({asyncUtilTimeout: 8000});
