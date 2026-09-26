import type {ManageConfig} from "@/api/manage";

type RGB = [number, number, number];
type Theme = ManageConfig["Theme"];

function parseColor(value: string): RGB | null {
    if (!/^#[0-9a-fA-F]{6}$/.test(value.trim())) return null;
    const hex = value.trim();
    return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)) as RGB;
}

function toHex(color: RGB): string {
    return `#${color.map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function luminance(color: RGB): number {
    const channels = color.map(value => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: RGB, b: RGB): number {
    const x = luminance(a);
    const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function whiteTextContrast(brandInput: string): number | null {
    const brand = parseColor(brandInput);
    return brand ? contrast(brand, [255, 255, 255]) : null;
}

function mix(a: RGB, b: RGB, share: number): RGB {
    return a.map((value, index) => Math.floor(value * (1 - share) + b[index] * share + 0.5)) as RGB;
}

function readable(accent: RGB, background: RGB): string {
    const target: RGB = luminance(background) <= 0.4 ? [255, 255, 255] : [0, 0, 0];
    for (let step = 0; step <= 50; step++) {
        const candidate = mix(accent, target, step * 0.02);
        if (contrast(candidate, background) >= 4.5) return toHex(candidate);
    }
    return toHex(target);
}

// Mirrors AP Backend's eventConfig.deriveTheme for unsaved previews. The server
// response is authoritative after Save, including its version.
export function deriveTheme(brandInput: string, accentInput: string, version: number): Theme | null {
    const brand = parseColor(brandInput);
    if (!brand) return null;
    const accentText = accentInput.trim();
    const accent = accentText ? parseColor(accentText) : null;
    if (accentText && !accent) return null;
    const brandHex = toHex(brand);
    if (!accent) {
        return {Brand: brandHex, Accent: "", AccentLight: brandHex, AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: version};
    }
    return {
        Brand: brandHex,
        Accent: toHex(accent),
        AccentLight: readable(accent, [247, 247, 249]),
        AccentDark: readable(accent, mix([64, 63, 65], brand, 0.25)),
        AccentLive: readable(accent, brand),
        Version: version,
    };
}
