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
