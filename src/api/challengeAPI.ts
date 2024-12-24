import {baseAPI} from "@/api/baseAPI";
import {IResponse} from "@/types/api";
import {IChallengeInfoCategoryInfo, ITeamSolution, ISolveChallenge, ISolveChallengeResult} from "@/types/challenge";
import {AxiosResponse} from "axios";

export const getChallengesFn = async (): Promise<AxiosResponse<IResponse<IChallengeInfoCategoryInfo[]>, any>> => {
    return await baseAPI.get('events/self/challenges/info')
};

export const challengeSolvedByFn = async (id: string): Promise<AxiosResponse<IResponse<ITeamSolution[]>, any>> => {
    return await baseAPI.get(`events/self/challenges/${id}/solvedBy`)
};


export const solveChallengeFn = async (challengeID: string, data: ISolveChallenge): Promise<AxiosResponse<IResponse<ISolveChallengeResult>, any>> => {
    return await baseAPI.post(`events/self/challenges/${challengeID}/solve`, data)
};

