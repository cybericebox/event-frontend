import {whiteTextContrast} from "./deriveTheme";

type Color = {r: number; g: number; b: number; count: number};
const hex = ({r, g, b}: Color) => `#${[r, g, b].map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

export async function paletteFromLogo(file: File): Promise<{brand: string; accent: string} | null> {
    try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = 64; canvas.height = 64;
        const context = canvas.getContext("2d", {willReadFrequently: true});
        if (!context) {bitmap.close(); return null;}
        context.drawImage(bitmap, 0, 0, 64, 64);
        bitmap.close();
        const pixels = context.getImageData(0, 0, 64, 64).data;
        const buckets = new Map<string, Color>();
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] < 170) continue;
            const r = Math.min(255, Math.round(pixels[i] / 32) * 32);
            const g = Math.min(255, Math.round(pixels[i + 1] / 32) * 32);
            const b = Math.min(255, Math.round(pixels[i + 2] / 32) * 32);
            if (Math.max(r, g, b) - Math.min(r, g, b) < 28) continue;
            const key = `${r},${g},${b}`;
            const current = buckets.get(key);
            buckets.set(key, {r, g, b, count: (current?.count ?? 0) + 1});
        }
        const colors = [...buckets.values()].sort((a, b) => b.count - a.count);
        // A tiny dark detail must not become the brand when the logo is mostly pale.
        const sampled = colors.reduce((total, color) => total + color.count, 0);
        const brand = colors.slice(0, 5).find(color =>
            color.count / sampled >= 0.05 && (whiteTextContrast(hex(color)) ?? 0) >= 4.5
        );
        if (!brand) return null;
        const accent = colors.find(color => color !== brand && Math.abs(color.r - brand.r) + Math.abs(color.g - brand.g) + Math.abs(color.b - brand.b) > 100);
        return {brand: hex(brand), accent: accent ? hex(accent) : ""};
    } catch {return null;}
}
