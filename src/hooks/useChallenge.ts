'use client'
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {challengeSolvedByFn, getChallengesFn, SolveChallengeData, solveChallengeFn} from "@/api/challengeAPI";

const refetchInterval = 30 * 1000

const useGetChallenges = (enabled: boolean) => {
    return useQuery({
        queryKey: ['challenges'],
        queryFn: getChallengesFn,
        enabled: enabled,
        refetchOnWindowFocus: true,
        refetchInterval: refetchInterval,
    })
}

const useChallengeSolvedBy = (id: string) => {
    return useQuery({
        queryKey: ['challengeSolved', id],
        queryFn: async () => await challengeSolvedByFn(id),
        enabled: !!id,
        refetchOnWindowFocus: true,
        refetchInterval: refetchInterval,
    })
}

const useSolveChallenge = (id: string) => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["solve", id],
        mutationFn: async (data: SolveChallengeData) => await solveChallengeFn(id, data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['challenges']}).catch((e) => console.log(e))
            client.invalidateQueries({queryKey: ['challengeSolved', id]}).catch((e) => console.log(e))
        }

    })
}


export const useChallenge = () => {
    return {
        useGetChallenges,
        useChallengeSolvedBy,
        useSolveChallenge,
    }
};

