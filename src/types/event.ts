import {z} from "zod";
import {ChallengeInfoSchema} from "@/types/challenge";

export enum EventTypeEnum {
    Competition = 0,
    Practice = 1,
}

export enum ParticipationTypeEnum {
    Individual = 0,
    Team = 1,
}

export enum RegistrationTypeEnum {
    Close = 0,
    Approval = 1,
    Open = 2,
}

export enum ScoreboardVisibilityTypeEnum {
    Hidden = 0,
    Private = 1,
    Public = 2,
}

export enum ParticipantsVisibilityTypeEnum {
    Hidden = 0,
    Private = 1,
    Public = 2,
}

export const EventInfoSchema = z.object({
    Tag: z.string(),
    Name: z.string(),
    Description: z.string(),
    Rules: z.string(),
    Picture: z.string().refine((v) => {
        if (v === "") {
            return true;
        }
        return z.string().url().safeParse(v).success;
    }),

    Type: z.nativeEnum(EventTypeEnum),
    Participation: z.nativeEnum(ParticipationTypeEnum),

    StartTime: z.coerce.date(),
    FinishTime: z.coerce.date(),

    Registration: z.nativeEnum(RegistrationTypeEnum),
    ScoreboardAvailability: z.nativeEnum(ScoreboardVisibilityTypeEnum),
    ParticipantsVisibility: z.nativeEnum(ParticipantsVisibilityTypeEnum),
})

export interface IEventInfo extends z.infer<typeof EventInfoSchema> {
}

export enum ParticipationStatusEnum {
    NoParticipationStatus = 0,
    PendingParticipationStatus = 1,
    ApprovedParticipationStatus = 2,
    RejectedParticipationStatus = 3,
}

export const JoinEventInfoSchema = z.object({
    Status: z.nativeEnum(ParticipationStatusEnum),
})

export interface IJoinEventInfo extends z.infer<typeof JoinEventInfoSchema> {
}

export const TeamChallengeSolutionSchema = z.object({
    ChallengeID : z.string().uuid(),
    SolvedRank: z.number().int(),
})


export const TeamScoreSchema = z.object({
    InChart: z.boolean().optional(), // not from API
    TeamID: z.string().uuid(),
    TeamName: z.string(),
    Rank: z.number().int(),
    Score: z.number().int(),
    LatestSolution: z.coerce.date(),
    TeamSolutions: z.record(z.string().uuid(), TeamChallengeSolutionSchema),
    TeamScoreTimeline: z.array(z.tuple([z.coerce.date(), z.number().int()])),
})

export interface ITeamScore extends z.infer<typeof TeamScoreSchema> {}

export const ActiveChartSeriesItemSchema = z.object({
    name: z.string(),
    data: z.array(z.tuple([z.coerce.date(), z.number().int()])),
    type: z.string(),
})

export interface IActiveChartSeriesItem extends z.infer<typeof ActiveChartSeriesItemSchema> {}

export const EventScoreSchema = z.object({
    Challenges: z.array(ChallengeInfoSchema.pick({ID: true, Name: true})),
    TeamsScores: z.array(TeamScoreSchema),
    ActiveChartSeries: z.array(ActiveChartSeriesItemSchema).optional(), // not from API
})

export interface IEventScore extends z.infer<typeof EventScoreSchema> {}




