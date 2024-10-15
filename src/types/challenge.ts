import { z } from 'zod';

export const ChallengeFileSchema = z.object({
    ID: z.string().uuid(),
    Name: z.string(),
})

export const ChallengeInfoSchema = z.object({
    ID: z.string().uuid(),
    Name: z.string(),
    Points: z.number().int(),
    Description: z.string(),
    AttachedFiles: z.array(ChallengeFileSchema),

    Solved: z.boolean(),
})


export interface IChallengeInfo extends z.infer<typeof ChallengeInfoSchema> {}

export const ChallengeCategoryInfoSchema = z.object({
    ID: z.string().uuid(),
    Name: z.string(),
    Challenges: z.array(ChallengeInfoSchema),
})

export interface IChallengeInfoCategoryInfo extends z.infer<typeof ChallengeCategoryInfoSchema> {}

export const SolveChallengeSchema = z.object({
    Solution : z.string(),
})

export interface ISolveChallenge extends z.infer<typeof SolveChallengeSchema> {}

export const SolveChallengeResultSchema = z.object({
    Solved: z.boolean(),
})

export interface ISolveChallengeResult extends z.infer<typeof SolveChallengeResultSchema> {}

export const TeamSolutionSchema = z.object({
    ID: z.string().uuid(),
    Name: z.string(),
    SolvedAt: z.coerce.date(),
})

export interface ITeamSolution extends z.infer<typeof TeamSolutionSchema> {}

