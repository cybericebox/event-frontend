import {z} from "zod";

export const ownTeamSchema = z.object({
    ID: z.string().uuid(), Name: z.string(), MemberCount: z.number().int(),
    // The join code and its expiry are sent to the captain only.
    JoinCode: z.string().nullish().transform(value => value ?? ""), JoinCodeExpiresAt: z.string().nullish().transform(value => value ?? null),
    CaptainID: z.string().uuid().optional(),
    // TeamRole: 0 = captain, 1 = member.
    Role: z.number().int().default(1),
    ExtraFields: z.record(z.string(), z.unknown()).nullish().transform(value => value ?? {}),
    Admitted: z.boolean().optional(), MinTeamSize: z.number().int().nullish(), MaxTeamSize: z.number().int().nullish(),
    // Required team fields the organizer asked every team for and this team has not filled.
    MissingFields: z.array(z.string()).nullish(), BlockingFields: z.boolean().optional(),
    // The roster is closed for good (FormedAt says when); only a formed team gets tasks.
    Formed: z.boolean().optional(), FormedAt: z.string().nullish(),
});
export type OwnTeam = z.infer<typeof ownTeamSchema>;

