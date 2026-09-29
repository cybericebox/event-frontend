// Readable block anchors: lowercase latin letters, digits and hyphens (the
// backend rule), unique on the page and different from other block ids.
import {t} from "@/i18n/t";

export const anchorPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const maxAnchorLength = 64;

// Ukrainian national transliteration (KMU 2010), simplified to lowercase.
const letters: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch",
    ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ы: "y", э: "e", ё: "io", ъ: "", "’": "", "'": "", "ʼ": "",
};

export function anchorFromText(text: string): string {
    const latin = [...text.toLocaleLowerCase("uk").replace(/\{\{[^}]*\}\}/g, " ")].map(char => letters[char] ?? char).join("");
    return latin.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, maxAnchorLength).replace(/-+$/, "");
}

export function anchorError(anchor: string, inUse: string[]): string | null {
    if (!anchor) return null;
    if (anchor.length > maxAnchorLength || !anchorPattern.test(anchor)) return t("manage.blocks.anchor.invalid", {max: maxAnchorLength});
    if (inUse.includes(anchor)) return t("manage.blocks.anchor.taken");
    return null;
}
