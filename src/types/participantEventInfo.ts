import {z} from "zod";
import {ResultsAvailabilitySchema} from "@/types/resultsAvailability";

// This shape is returned only after approval for this specific event.
export const ParticipantEventInfoSchema = z.object({
    EventID: z.string().uuid(),
    UseVPN: z.boolean(),
    CanViewResults: z.boolean(),
    ResultsAvailability: ResultsAvailabilitySchema.optional(),
    CanViewParticipants: z.boolean(),
    Participation: z.union([z.literal(0), z.literal(1)]).nullish(),
    RealName: z.string().optional(),
    Pseudonym: z.string().nullish(),
    DisplayName: z.string().optional(),
    AllowPseudonyms: z.boolean().optional(),
    PseudonymEditable: z.boolean().optional(),
    TeamID: z.string().uuid().nullish(),
    TeamAdmitted: z.boolean().nullish(),
    MinTeamSize: z.number().int().nullish(),
    MaxTeamSize: z.number().int().nullish(),
});

export type ParticipantEventInfo = z.infer<typeof ParticipantEventInfoSchema>;
