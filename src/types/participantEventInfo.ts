import {z} from "zod";
import {ResultsAvailabilitySchema} from "@/types/resultsAvailability";

// This shape is returned only after approval for this specific event.
export const ParticipantEventInfoSchema = z.object({
    EventID: z.string().uuid(),
    UseVPN: z.boolean(),
    CanViewResults: z.boolean(),
    ResultsAvailability: ResultsAvailabilitySchema.optional(),
    // The results are readable now and the live screen is open to participants.
    CanOpenLive: z.boolean().default(false),
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
    // Board presentation (event settings) and whether any task needs the team VPN.
    ShowDifficulty: z.boolean().default(true),
    // Hints hidden for every task (a task shows hints only when it enables them).
    HintsDisabled: z.boolean().default(false),
    HasInfrastructureChallenges: z.boolean().default(false),
    // How paid hints are charged: reduce the challenge reward, or the balance at unlock.
    HintChargeMode: z.enum(["reward", "balance"]).catch("reward"),
});

export type ParticipantEventInfo = z.infer<typeof ParticipantEventInfoSchema>;
