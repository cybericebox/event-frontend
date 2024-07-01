import {Challenge} from "@/types/challenge";

export interface EventInfo {
    ID: string;
    Tag: string;
    Name: string;
    Description: string;
    Rules: string;
    Picture: string;

    Type: number;
    Participation: number;


    StartTime: Date;
    FinishTime: Date;

    Registration: number;
    ScoreboardAvailability: number;
    ParticipantsVisibility: number;

}

export enum RegistrationType {
    Open = 0,
    Approval = 1,
    Close = 2,
}

export enum ParticipationStatus {
    NoParticipationStatus = 0,
    PendingParticipationStatus = 1,
    ApprovedParticipationStatus = 2,
    RejectedParticipationStatus = 3,

}

export enum ParticipationType {
    Individual = 0,
    Team = 1,
}

export enum ScoreboardVisibilityType {
    Hidden = 0,
    Public = 1,
    Private = 2,
}

export enum EventType {
    Competition = 0,
    Practice = 1,

}

export enum ParticipantsVisibilityType {
    Hidden = 0,
    Public = 1,
    Private = 2,
}

export interface Score {
    ChallengeList: Challenge[];
    TeamsScores: TeamScore[];
    ActiveChartSeries: ActiveChartSeriesItem[];
}

export interface TeamScore {
    InChart: boolean;
    TeamName: string;
    Rank: number;
    Score: number;
    LastSolution: Date;
    TeamSolutions: { [id: string]: TeamSolution; };
    TeamScoreTimeline: [Date, number][];
}

interface TeamSolution {
    ID: string;
    Rank: number;
}

export interface ActiveChartSeriesItem {
    name: string;
    data: [Date, number][];
    type: string;
}





