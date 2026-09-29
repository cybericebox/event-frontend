// Pure helpers of EventDateTimePicker. Values are wall-clock strings in the
// viewer's time zone ("YYYY-MM-DDTHH:mm" or with ":ss"); callers convert them
// to UTC ISO with localToISO before sending them to the API.

const pad = (value: number) => String(value).padStart(2, "0");

export const datePart = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function parseLocal(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// A date-only value ("YYYY-MM-DD") as local midnight.
export function parseLocalDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return datePart(date) === value ? date : null;
}

export function formatLocal(date: Date, seconds = false): string {
    return `${datePart(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}${seconds ? `:${pad(date.getSeconds())}` : ""}`;
}

// ISO (UTC) from the API → the picker's local value; "" for none or invalid.
export function localFromISO(iso: string | null | undefined, seconds = false): string {
    if (!iso) return "";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : formatLocal(date, seconds);
}

// The picker's local value → ISO (UTC) for the API; null for none or invalid.
export function localToISO(value: string): string | null {
    const date = parseLocal(value);
    return date ? date.toISOString() : null;
}

export const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

// Six Monday-first weeks around the month, so the grid never changes height.
export function calendarDays(month: Date): Date[] {
    const offset = (monthStart(month).getDay() + 6) % 7;
    return Array.from({length: 42}, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
}

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Same day in another month, clamped to that month's last day (31 Jan → 28 Feb).
function addMonths(date: Date, months: number): Date {
    const last = new Date(date.getFullYear(), date.getMonth() + months + 1, 0).getDate();
    return new Date(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), last));
}

// Grid keyboard: arrows move by day/week, Home/End to the week's ends,
// PageUp/PageDown by month (with Shift by year). null for other keys.
export function moveDay(date: Date, key: string, shift = false): Date | null {
    switch (key) {
        case "ArrowLeft": return addDays(date, -1);
        case "ArrowRight": return addDays(date, 1);
        case "ArrowUp": return addDays(date, -7);
        case "ArrowDown": return addDays(date, 7);
        case "Home": return addDays(date, -((date.getDay() + 6) % 7));
        case "End": return addDays(date, 6 - (date.getDay() + 6) % 7);
        case "PageUp": return addMonths(date, shift ? -12 : -1);
        case "PageDown": return addMonths(date, shift ? 12 : 1);
        default: return null;
    }
}

// A time part typed by hand: digits only, within 0..max; null otherwise.
export function timePart(raw: string, max: number): number | null {
    if (!/^\d{1,2}$/.test(raw.trim())) return null;
    const value = Number(raw);
    return value <= max ? value : null;
}

// ArrowUp/ArrowDown on a time part, wrapping around (23 → 0).
export const stepTime = (value: number, delta: number, max: number) => (value + delta + max + 1) % (max + 1);

// The viewer's zone, e.g. "Europe/Kyiv" and its current offset "GMT+3".
export function zoneLabel(at: Date = new Date()): {zone: string; offset: string} {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Intl.DateTimeFormat("en-US", {timeZoneName: "shortOffset"}).formatToParts(at).find(part => part.type === "timeZoneName")?.value ?? "";
    return {zone, offset};
}
