import {z} from "zod";

const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const EventThemeSchema = z.object({
    Brand: color,
    Accent: z.union([color, z.literal("")]),
    AccentLight: color,
    AccentDark: color,
    AccentLive: color,
    Version: z.number().int().positive(),
});
