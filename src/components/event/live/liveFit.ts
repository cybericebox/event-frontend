// Fit rules shared by the live screen and the editor warnings, so what the
// editor promises and what the screen renders always agree. Sizes are in
// screen pixels; `caption` and `body` are the effective text sizes of the
// canvas (liveTextSize).

// A widget caption («Таблиця результатів») takes this many caption sizes,
// its gap to the content included.
export const liveCaptionBlock = 1.8;
// The table header row, in caption sizes.
export const liveHeaderRow = 1.7;
// Row text is the row height divided by this; a row is readable while its
// text stays at least the body size (≥ 19 px, read from 3–5 m).
export const liveRowLeading = 1.75;
// Row text never grows past this many body sizes, however tall the rows.
const liveRowTextMax = 2.4;

export type LiveListGeometry = {
    // Height the N rows share.
    rowsHeight: number;
    rowHeight: number;
    rowFont: number;
    // Most rows that stay readable in this widget.
    maxRows: number;
    readable: boolean;
};

// N rows split the space under the caption (and the header row) exactly.
export function liveListGeometry({height, caption, body, rows, header}: {height: number; caption: number; body: number; rows: number; header: boolean}): LiveListGeometry {
    const rowsHeight = Math.max(0, height - caption * liveCaptionBlock - (header ? caption * liveHeaderRow : 0));
    const count = Math.max(1, Math.floor(rows));
    const rowHeight = rowsHeight / count;
    const minRow = body * liveRowLeading;
    const maxRows = Math.max(0, Math.floor(rowsHeight / minRow + 1e-6));
    return {rowsHeight, rowHeight, rowFont: Math.min(rowHeight / liveRowLeading, body * liveRowTextMax), maxRows, readable: count <= maxRows};
}

// Reading time for a page of N rows: about 0.7 s a row plus 1.5 s to find
// the start, rounded up to whole seconds.
export function livePageSecondsHint(rows: number): number {
    return Math.ceil(1.5 + 0.7 * Math.max(1, rows));
}

// Monospace digit width and label letter width, in font sizes.
const digitWidth = 0.62;
const letterWidth = 0.56;
export const liveTimerLabelScale = {s: 0.75, m: 1, l: 1.35} as const;
export type LiveTimerLabelSize = keyof typeof liveTimerLabelScale;

// The largest digits that fit the widget, and a label above them sized
// relative to the digits (× label size), shrunk to fit the width.
export function liveTimerFit({width, height, digits, label, labelSize}: {width: number; height: number; digits: number; label: string | null; labelSize: LiveTimerLabelSize}): {digits: number; label: number} {
    const ratio = label ? 0.3 * liveTimerLabelScale[labelSize] : 0;
    const digitsFont = Math.max(0, Math.min(width / (digits * digitWidth), height / (1.08 + ratio * 1.3)));
    const labelFont = label ? Math.min(digitsFont * ratio, width / Math.max(1, label.length * letterWidth)) : 0;
    return {digits: digitsFont, label: labelFont};
}

// The event name on one line as large as the widget allows; the subtitle
// is half its size. `logo` is the square logo tile at the left, if any.
export function liveTitleFit({width, height, name, subtitle, logo}: {width: number; height: number; name: string; subtitle: boolean; logo: boolean}): {name: number; subtitle: number; logo: number} {
    const logoSize = logo ? height * 0.78 : 0;
    const textWidth = Math.max(0, width - (logo ? logoSize + height * 0.3 : 0));
    const nameFont = Math.max(0, Math.min(height * (subtitle ? 0.5 : 0.66), textWidth / Math.max(1, name.length * letterWidth)));
    return {name: nameFont, subtitle: subtitle ? nameFont * 0.5 : 0, logo: logoSize};
}
