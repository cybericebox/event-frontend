import {z} from "zod";

// This shape is returned only after approval for this specific event.
export const ParticipantEventInfoSchema = z.object({
    EventID: z.string().uuid(),
    UseVPN: z.boolean(),
    CanViewResults: z.boolean(),
    CanViewParticipants: z.boolean(),
});

export type ParticipantEventInfo = z.infer<typeof ParticipantEventInfoSchema>;
