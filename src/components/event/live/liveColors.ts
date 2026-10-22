import type {CSSProperties} from "react";
import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {colorContrast} from "@/components/event/manage/deriveTheme";

// Own colours of a block («Кольори»): every block keeps the screen theme
// (the event brand and accent) until it gets a fill, a text colour or an
// accent of its own. The text on a fill picks white or ink by contrast, so a
// fill never leaves unreadable text behind.

export const liveFills = ["none", "tile", "brand", "accent", "custom"] as const;
export type LiveFill = typeof liveFills[number];

export const liveHighlights = ["none", "accent", "medals"] as const;
export type LiveHighlight = typeof liveHighlights[number];

// «Позначка місць» of places 1–3 in a table, podium or leader cards.
export const liveMarkers = ["numbers", "medals", "medal-icons", "cups", "images"] as const;
export type LiveMarker = typeof liveMarkers[number];

// Gold, silver and bronze: bright enough for the dark theme, with dark text on them.
export const liveMedalColors = ["#F2C14E", "#C9D1DB", "#D98E5B"] as const;

const hexPattern = /^#[0-9a-fA-F]{6}$/;
const darkInk = "#16152B";
const lightInk = "#FFFFFF";
// Text needs 4.5:1 on its fill; accent marks (ranks, timer digits) 3:1.
export const liveTextContrastMin = 4.5;
export const liveAccentContrastMin = 3;

export function liveHex(value: unknown): string | null {
    return typeof value === "string" && hexPattern.test(value) ? value.toUpperCase() : null;
}

// The fill kind of a block: «none» unless it has one.
export function liveFillOf(widget: LiveWidget): LiveFill {
    const value = widget.props.background;
    if (value === "tile" || value === "brand" || value === "accent") return value;
    return liveHex(value) ? "custom" : "none";
}

export function liveHighlightOf(widget: LiveWidget): LiveHighlight {
    const value = widget.props.highlightTop;
    return value === "none" || value === "medals" ? value : "accent";
}

// The mark of places 1–3: its own choice, else medal circles with the medal highlight and plain numbers otherwise.
export function liveMarkerOf(widget: LiveWidget): LiveMarker {
    const value = widget.props.marker;
    return (liveMarkers as readonly unknown[]).includes(value) ? value as LiveMarker : liveHighlightOf(widget) === "medals" ? "medals" : "numbers";
}

// The organizer's three pictures of «Свої зображення», or null when not all three are set.
export function livePlaceImages(widget: LiveWidget): string[] | null {
    const value = widget.props.placeImages;
    return Array.isArray(value) && value.length === 3 && value.every(item => typeof item === "string" && item) ? value as string[] : null;
}

export function livePlaceColors(widget: LiveWidget): string[] {
    const value = widget.props.placeColors;
    return Array.isArray(value) && value.length === 3 && value.every(item => liveHex(item)) ? value.map(item => (item as string).toUpperCase()) : [...liveMedalColors];
}

type Theme = PublicEventInfo["Theme"];

// The theme accent of the screen: the live accent on the dark theme, the light one on the light theme.
function themeAccent(theme: Theme, mode: LiveLayout["theme"]): string {
    return (mode === "light" ? liveHex(theme.AccentLight) : liveHex(theme.AccentLive)) ?? (mode === "light" ? "#211A52" : lightInk);
}

// The fill colour of a block as #RRGGBB; «tile» follows the theme and has none.
export function liveFillColor(widget: LiveWidget, theme: Theme, mode: LiveLayout["theme"]): string | null {
    const fill = liveFillOf(widget);
    if (fill === "brand") return liveHex(theme.Brand) ?? "#211A52";
    if (fill === "accent") return themeAccent(theme, mode);
    if (fill === "custom") return liveHex(widget.props.background);
    return null;
}

// White or ink, whichever reads better on `background`.
export function liveReadableInk(background: string): string {
    return (colorContrast(lightInk, background) ?? 21) >= (colorContrast(darkInk, background) ?? 0) ? lightInk : darkInk;
}

export type LiveBlockColors = {
    className: string; style: CSSProperties;
    // The text and accent actually shown, and their contrast with the fill (null without a known fill).
    ink: string | null; accent: string | null; textContrast: number | null; accentContrast: number | null;
};

// The CSS of a block's own colours: a class for the fill, and the variables
// the block content reads (--live-ink, --live-accent, the place colours).
export function liveBlockColors(widget: LiveWidget, theme: Theme, mode: LiveLayout["theme"]): LiveBlockColors {
    const fill = liveFillOf(widget);
    const background = liveFillColor(widget, theme, mode);
    const style: Record<string, string> = {};
    const ownInk = liveHex(widget.props.textColor);
    const ink = ownInk ?? (background ? liveReadableInk(background) : null);
    if (background) style["--live-widget-bg"] = background;
    if (ink) style["--live-ink"] = ink;
    // An accent fill turns the accent marks into the text colour; any other
    // fill keeps the theme accent while it stays visible on it.
    const ownAccent = liveHex(widget.props.accentColor);
    const shownAccent = ownAccent ?? (background ? themeAccent(theme, mode) : null);
    const accent = ownAccent ?? (fill === "accent" || (background && shownAccent && (colorContrast(shownAccent, background) ?? 21) < liveAccentContrastMin) ? ink : shownAccent);
    if (ownAccent || (accent && accent !== themeAccent(theme, mode))) style["--live-accent"] = accent!;
    // Medal colours serve the medal highlight and the medal, cup and picture marks.
    if ((liveHighlightOf(widget) === "medals" || liveMarkerOf(widget) !== "numbers") && (widget.type === "table" || widget.type === "podium")) {
        livePlaceColors(widget).forEach((color, index) => {
            style[`--live-place-${index + 1}`] = color;
            style[`--live-place-ink-${index + 1}`] = liveReadableInk(color);
        });
    }
    const classes = [fill !== "none" ? `live-widget--fill live-widget--fill-${fill === "custom" ? "color" : fill}` : "", ink && fill === "none" ? "live-widget--inked" : ""].filter(Boolean);
    return {
        className: classes.join(" "), style: style as CSSProperties, ink, accent,
        textContrast: background && ink ? colorContrast(ink, background) : null,
        accentContrast: background && accent ? colorContrast(accent, background) : null,
    };
}
