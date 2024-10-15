import {z} from "zod";

export const TeamSchema = z.object({
    ID: z.string().uuid().optional(),
    Name: z.string().min(2).max(255),
    JoinCode: z.string().optional(),
    CreatedAt: z.coerce.date().optional(),
})

export interface ITeam extends z.infer<typeof TeamSchema> {}

export const JoinTeamSchema = TeamSchema.pick({JoinCode: true, Name: true}).required()

export interface IJoinTeam extends z.infer<typeof JoinTeamSchema> {}

export const CreateTeamSchema = TeamSchema.pick({Name: true}).required()

export interface ICreateTeam extends z.infer<typeof CreateTeamSchema> {}

export const VPNConfigSchema = z.string()

export type IVPNConfig = z.infer<typeof VPNConfigSchema>