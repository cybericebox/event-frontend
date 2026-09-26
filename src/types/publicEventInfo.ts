import {z} from "zod";
import {EventThemeSchema} from "@/types/eventTheme";

export const PublicEventInfoSchema = z.object({
    EventID: z.string().uuid(),
    Tag: z.string(),
    Name: z.string(),
    StartTime: z.string(),
    FinishTime: z.string().nullable(),
    Status: z.number().int(),
    Participation: z.number().int().nullable(),
    Registration: z.number().int(),
    ScoreboardVisibility: z.number().int(),
    ParticipantsVisibility: z.number().int(),
    PreviewDescription: z.string(),
    PreviewPicture: z.string(),
    Theme: EventThemeSchema,
});

export type PublicEventInfo = z.infer<typeof PublicEventInfoSchema>;
