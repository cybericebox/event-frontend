import {z} from "zod";
import {ResultsAvailabilitySchema} from "@/types/resultsAvailability";

// This shape is returned only after approval for this specific event.
export const ParticipantEventInfoSchema = z.object({
    EventID: z.string().uuid(),
    UseVPN: z.boolean(),
    CanViewResults: z.boolean(),
    ResultsAvailability: ResultsAvailabilitySchema.optional(),
    CanViewParticipants: z.boolean(),
});

export type ParticipantEventInfo = z.infer<typeof ParticipantEventInfoSchema>;
