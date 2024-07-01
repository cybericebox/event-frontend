import {Category, Solve} from "@/types/challenge";

export const getChallengesFn = async (): Promise<Category[]> => {
    return await fetch('api/events/self/challenges/info', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => res.json());
};

export const challengeSolvedByFn = async (id: string): Promise<Solve[]> => {
    return await fetch(`api/events/self/challenges/${id}/solvedBy`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => res.json());
};

export interface SolveChallengeData {
    Solution: string;
}

export const solveChallengeFn = async (id: string, data: SolveChallengeData) => {
    return await fetch(`api/events/self/challenges/${id}/solve`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    }).then(res => res.json());
};

