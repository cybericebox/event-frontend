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

// N rows split the space under the caption (and the header row) exactly; a
// hidden caption leaves its room to the rows.
export function liveListGeometry({height, caption, body, rows, header, captionShown = true}: {height: number; caption: number; body: number; rows: number; header: boolean; captionShown?: boolean}): LiveListGeometry {
    const rowsHeight = Math.max(0, height - (captionShown ? caption * liveCaptionBlock : 0) - (header ? caption * liveHeaderRow : 0));
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
// relative to the digits (× label size), shrunk to fit the width. `digits`
// is the length of what stands in the digits line (a word after the target).
// The label keeps at least `labelMin` (the caption floor): the digits give
// way. A freeze `badge` takes a line under the digits; when the digits would
// drop below `digitsMin` with three lines, the badge takes the label's place.
// `labelMax` caps the label and the badge of a very large timer (a pre-start
// countdown), so they stay captions and leave the room to the digits.
export function liveTimerFit({width, height, digits, label, labelSize, badge = null, labelMin = 0, digitsMin = 0, labelMax = Number.POSITIVE_INFINITY}: {
    width: number; height: number; digits: number; label: string | null; labelSize: LiveTimerLabelSize; badge?: string | null; labelMin?: number; digitsMin?: number; labelMax?: number;
}): {digits: number; label: number; badge: number; labelShown: boolean} {
    const byWidth = width / Math.max(1, digits * digitWidth);
    const fitText = (text: string | null, size: number, extra: number) => text ? Math.min(size, width / Math.max(1, text.length * letterWidth + extra)) : 0;
    const lines = (top: string | null, topRatio: number, bottom: string | null) => {
        const bottomRatio = bottom ? 0.3 : 0;
        const natural = Math.min(byWidth, height / (1.08 + topRatio * 1.3 + bottomRatio * 1.4));
        const cap = Math.max(labelMin, labelMax * (top === label ? liveTimerLabelScale[labelSize] : 1));
        const topFont = top ? Math.max(Math.min(natural * topRatio, cap), labelMin) : 0;
        const bottomFont = bottom ? Math.max(Math.min(natural * bottomRatio, labelMax), labelMin) : 0;
        const digitsFont = Math.max(0, Math.min(byWidth, (height - topFont * 1.3 - bottomFont * 1.4) / 1.08));
        // The label never drops below its floor: a long one ends with «…» instead.
        const topText = top === badge ? fitText(top, topFont, 2.4) : Math.max(Math.min(labelMin, topFont), fitText(top, topFont, 0));
        return {digits: digitsFont, top: topText, bottom: fitText(bottom, bottomFont, 2.4)};
    };
    const labelRatio = label ? 0.3 * liveTimerLabelScale[labelSize] : 0;
    if (!badge) {
        const two = lines(label, labelRatio, null);
        return {digits: two.digits, label: two.top, badge: 0, labelShown: label !== null};
    }
    const three = lines(label, labelRatio, badge);
    if (!label || three.digits >= digitsMin) return {digits: three.digits, label: three.top, badge: three.bottom, labelShown: label !== null};
    // Too low for three lines: the badge replaces the label above the digits.
    const two = lines(badge, 0.3, null);
    return {digits: two.digits, label: 0, badge: two.top, labelShown: false};
}

// The event name on one line as large as the widget allows; the subtitle
// is half its size but never below `subtitleMin` (the caption floor), so a
// long name does not shrink it out of sight. `logo` is the square logo tile
// at the left, if any.
export function liveTitleFit({width, height, name, subtitle, logo, subtitleMin = 0}: {width: number; height: number; name: string; subtitle: boolean; logo: boolean; subtitleMin?: number}): {name: number; subtitle: number; logo: number} {
    const logoSize = logo ? height * 0.78 : 0;
    const textWidth = Math.max(0, width - (logo ? logoSize + height * 0.3 : 0));
    const nameFont = Math.max(0, Math.min(height * (subtitle ? 0.5 : 0.66), textWidth / Math.max(1, name.length * letterWidth)));
    return {name: nameFont, subtitle: subtitle ? Math.min(Math.max(nameFont * 0.5, subtitleMin), height * 0.3) : 0, logo: logoSize};
}

// Table rows: the cell padding (.45em on each side) and the share of the row
// width the name column keeps at least.
const cellPadding = 0.9;
const nameShare = 0.55;
// Line height of a name that wraps to two lines, in font sizes.
const nameLeading = 1.15;

export type LiveNameFit = {font: number; lines: 1 | 2};
export type LiveTableFit = {
    // Row text of the rank and points columns.
    font: number;
    // Column widths in px: they follow the digits, not the name.
    rankWidth: number;
    pointsWidth: number;
    nameWidth: number;
    names: LiveNameFit[];
};

// Estimated text width at a font size; the screen passes a real measure.
export type LiveMeasure = (text: string, font: number) => number;
export const liveEstimateWidth: LiveMeasure = (text, font) => text.length * letterWidth * font;

// The table row text fits the row height and the width: the rank and points
// columns are as wide as their digits, and the name column keeps at least
// 55% of the row. A name that does not fit shrinks its own row text down to
// the body size, then wraps to two lines in a row tall enough, and only then
// ends with «…».
export function liveTableFit({width, rowHeight, body, rankChars, pointsChars, names, measure = liveEstimateWidth}: {
    width: number; rowHeight: number; body: number; rankChars: number; pointsChars: number; names: string[]; measure?: LiveMeasure;
}): LiveTableFit {
    const byHeight = Math.min(rowHeight / liveRowLeading, body * liveRowTextMax);
    const columnsEm = (rankChars + pointsChars) * digitWidth + 2 * cellPadding;
    const byWidth = (1 - nameShare) * width / columnsEm;
    const font = Math.max(Math.min(byHeight, byWidth), Math.min(body, byHeight));
    const rankWidth = (rankChars * digitWidth + cellPadding) * font;
    const pointsWidth = (pointsChars * digitWidth + cellPadding) * font;
    const nameWidth = Math.max(0, width - rankWidth - pointsWidth);
    const floor = Math.min(font, body);
    // The name cell keeps the padding of the row text whatever its own size,
    // so names of different sizes line up.
    const room = Math.max(0, nameWidth - cellPadding * font);
    const fitName = (name: string): LiveNameFit => {
        const natural = measure(name, font);
        if (natural <= room) return {font, lines: 1};
        // Width is linear in the font size: solve for the size that fits.
        const perPx = natural / font;
        const oneLine = room / perPx;
        if (oneLine >= floor) return {font: oneLine, lines: 1};
        // Two lines lose some width at the break: keep 10% of it spare.
        const twoLines = Math.min(font, rowHeight / (2 * nameLeading), room * 1.8 / perPx);
        if (twoLines >= floor) return {font: twoLines, lines: 2};
        return {font: floor, lines: rowHeight >= 2 * nameLeading * floor ? 2 : 1};
    };
    // One size for the one-line names of a page, so neighbouring rows match;
    // a wrapped name keeps its own.
    const fitted = names.map(fitName);
    const oneLine = Math.min(font, ...fitted.filter(name => name.lines === 1).map(name => name.font));
    return {font, rankWidth, pointsWidth, nameWidth, names: fitted.map(name => name.lines === 1 ? {font: oneLine, lines: 1} : name)};
}

// Podium: three tiles side by side in the order 2-1-3, the winner's the
// tallest. Tile heights as shares of the block; the name gets up to two
// lines, the place and the points a line each.
export const livePodiumHeights = [1, 0.82, 0.72] as const;
const podiumLines = 0.72 + 2 * nameLeading + 0.72;

export type LivePodiumFit = {
    // Name text of places 2–3 and of the winner, the place and points text.
    name: number; lead: number; meta: number;
    gap: number; pad: number;
    readable: boolean;
};

// The names fit the narrowest and lowest tile (the third); the winner's name
// is a fifth larger when its tile allows. Readable while the names keep the
// body size.
export function livePodiumFit({width, height, names, body, caption, measure = liveEstimateWidth}: {
    width: number; height: number; names: string[]; body: number; caption: number; measure?: LiveMeasure;
}): LivePodiumFit {
    const gap = Math.max(4, width * 0.02);
    const tile = Math.max(0, (width - 2 * gap) / 3);
    const pad = Math.max(4, Math.min(tile, height) * 0.08);
    const room = Math.max(0, tile - 2 * pad);
    const lowest = height * livePodiumHeights[2] - 2 * pad;
    const widest = Math.max(1, ...names.map(name => measure(name, 1)));
    const byHeight = lowest / podiumLines;
    const byWidth = room * 1.8 / widest;
    const name = Math.max(0, Math.min(byHeight, byWidth, body * 3));
    const lead = Math.min(name * 1.2, (height - 2 * pad) / podiumLines, room * 1.8 / widest * 1.2);
    return {name, lead: Math.max(name, lead), meta: Math.max(caption, name * 0.6), gap, pad, readable: name >= body};
}

// «Подіум → Картки»: three equal cards, each a name line over the points and
// an optional ring. The names fit the card next to the place badge; the
// points and the ring share the rest of the card.
export type LiveCardsFit = {name: number; meta: number; points: number; ring: number; gap: number; pad: number; readable: boolean};

// A cards block taller than wide stacks the cards: each gets the full width
// and a third of the height. The size the fit sees is that of one row of
// three such cards.
export function liveCardsBox(width: number, height: number): {column: boolean; gap: number; width: number; height: number} {
    const column = height > width * 0.9;
    const gap = Math.max(4, Math.min(width, height) * 0.02);
    return column ? {column, gap, width: width * 3 + 2 * gap, height: (height - 2 * gap) / 3} : {column, gap, width, height};
}

export function liveCardsFit({width, height, names, pointsChars, ring, body, caption, measure = liveEstimateWidth}: {
    width: number; height: number; names: string[]; pointsChars: number; ring: boolean; body: number; caption: number; measure?: LiveMeasure;
}): LiveCardsFit {
    const gap = Math.max(4, width * 0.02);
    const card = Math.max(0, (width - 2 * gap) / 3);
    const pad = Math.max(4, Math.min(card, height) * 0.06);
    const inner = Math.max(0, card - 2 * pad);
    const widest = Math.max(1, ...names.map(name => measure(name, 1)));
    // The badge takes about two of its own letters plus a gap beside the name.
    const byWidth = inner / (widest + 1.6);
    const name = Math.max(0, Math.min(byWidth, height * 0.2, body * 2.4));
    const meta = Math.max(caption, name * 0.62);
    const bodyHeight = Math.max(0, height - 2 * pad - Math.max(name * 1.3, meta * 1.9));
    const ringSize = ring ? Math.max(0, Math.min(bodyHeight * 0.92, inner * 0.48)) : 0;
    const pointsRoom = inner - (ringSize ? ringSize + meta * 0.6 : 0);
    const points = Math.max(0, Math.min(pointsRoom / Math.max(1, pointsChars * digitWidth), (bodyHeight - meta * 1.3) / 1.15, name * 1.5));
    return {name, meta, points, ring: ringSize, gap, pad, readable: name >= body};
}

// Facts: N numbers side by side, each a large value over a caption-sized
// label. `value` and `label` are character counts.
export type LiveFactsFit = {value: number; label: number; gap: number; readable: boolean};

export function liveFactsFit({width, height, items, display, caption}: {
    width: number; height: number; items: {value: number; label: number; text?: boolean}[]; display: number; caption: number;
}): LiveFactsFit {
    const count = Math.max(1, items.length);
    const gap = Math.max(8, width * 0.03);
    const cell = Math.max(0, (width - gap * (count - 1)) / count);
    const byWidth = Math.min(...items.map(item => cell / Math.max(1, item.value * (item.text ? letterWidth : digitWidth))), Number.POSITIVE_INFINITY);
    const labelNatural = (value: number) => Math.max(caption, value * 0.36);
    // value × 1.1 + label × 1.3 fill the height.
    const byHeight = height / (1.1 + 0.36 * 1.3);
    // Facts stay below the timer: at most twice the display size.
    let value = Math.max(0, Math.min(byWidth, byHeight, display * 2.2));
    let label = labelNatural(value);
    if (value * 1.1 + label * 1.3 > height) {
        label = caption;
        value = Math.max(0, Math.min(byWidth, (height - label * 1.3) / 1.1));
    }
    const widestLabel = Math.max(1, ...items.map(item => item.label));
    label = Math.max(caption, Math.min(label, cell / (widestLabel * letterWidth)));
    return {value, label, gap, readable: value >= display};
}

// An announcement fills its block: one line as large as the box allows, or
// two lines when that reads larger; never below the display floor.
export function liveAnnouncementFit({width, height, chars, display}: {width: number; height: number; chars: number; display: number}): {font: number; lines: 1 | 2} {
    // Semibold letters run wider than the body estimate; 6% of the width stays spare.
    const perPx = Math.max(1, chars) * letterWidth * 1.12;
    const one = Math.min(height / 1.3, width * 0.94 / perPx);
    // Two lines lose some width at the break: keep 10% of it spare.
    const two = Math.min(height / (2 * 1.2 + 0.2), width * 1.8 / perPx);
    return two > one * 1.15 ? {font: Math.max(display, two), lines: 2} : {font: Math.max(display, one), lines: 1};
}

// A list row of two lines (a stage: its name, then its time and status):
// the name as large as the row and the width allow but never below the body
// size, the second line 0.75 of it but never below the caption size. Not
// readable when the two lines at those floors do not fit the row height, or
// the longest name (`chars`) does not fit the width.
export type LiveTwoLineFit = {name: number; meta: number; readable: boolean};
const twoLineHeight = (name: number, meta: number) => name * 1.2 + meta * 1.25 + name * 0.3;

export function liveTwoLineRow({rowHeight, width, chars, body, caption}: {rowHeight: number; width: number; chars: number; body: number; caption: number}): LiveTwoLineFit {
    // The row keeps .4em of padding on each side.
    const perPx = Math.max(1, chars) * letterWidth + 0.8;
    const byHeight = rowHeight / (1.2 + 0.75 * 1.25 + 0.3);
    const byWidth = width / perPx;
    const name = Math.max(body, Math.min(byHeight, byWidth, body * liveRowTextMax));
    const meta = Math.max(caption, name * 0.75);
    return {name, meta, readable: twoLineHeight(name, meta) <= rowHeight + 0.5 && name * perPx <= width + 0.5};
}
