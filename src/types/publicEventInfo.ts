import {z} from "zod";
import {EventThemeSchema} from "@/types/eventTheme";
import {ResultsAvailabilitySchema} from "@/types/resultsAvailability";

export const PublicEventInfoSchema = z.object({
    EventID: z.string().uuid(),
    Tag: z.string(),
    Name: z.string(),
    StartTime: z.string(),
    FinishTime: z.string().nullable(),
    Status: z.number().int(),
    Participation: z.number().int().nullable(),
    Registration: z.number().int(),
    CanViewResults: z.boolean(),
    ResultsAvailability: ResultsAvailabilitySchema.optional(),
    CanViewParticipants: z.boolean(),
    PreviewDescription: z.string(),
    PreviewPicture: z.string(),
    LogoURL: z.string().default(""),
    FaviconURL: z.string().default(""),
    Theme: EventThemeSchema,
    // Participant countdown on «Завдання» and «Результати»: to the start, and to the finish
    // during its last FinishCountdownMinutes.
    ShowStartCountdown: z.boolean().default(true),
    ShowFinishCountdown: z.boolean().default(true),
    FinishCountdownMinutes: z.number().int().min(1).max(1440).default(10),
});

export type PublicEventInfo = z.infer<typeof PublicEventInfoSchema>;
