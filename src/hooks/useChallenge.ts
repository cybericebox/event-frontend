'use client'
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {challengeSolvedByFn, getChallengesFn, solveChallengeFn} from "@/api/challengeAPI";
import {ChallengeCategoryInfoSchema, ISolveChallenge} from "@/types/challenge";
import {z} from "zod";
import {TeamSolutionSchema} from "@/types/challenge";

const refetchInterval = 30 * 1000

const useGetChallenges = (enabled: boolean) => {
    const {
        data: GetChallengesResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetChallenges
    } = useQuery({
        queryKey: ['challenges'],
        queryFn: getChallengesFn,
        enabled: enabled,
        refetchOnWindowFocus: true,
        refetchInterval: refetchInterval,
        select: (data) => {
            const res = z.array(ChallengeCategoryInfoSchema).safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        }
    })

    const GetChallengesRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetChallengesResponse, GetChallengesRequest, GetChallenges}
}

const useChallengeSolvedBy = (id: string) => {
    const {
        data: ChallengeSolvedByResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: ChallengeSolvedBy
    } = useQuery({
        queryKey: ['challengeSolved', id],
        queryFn: async () => await challengeSolvedByFn(id),
        enabled: !!id,
        refetchOnWindowFocus: true,
        refetchInterval: refetchInterval,
        select: (data) => {
            const res = z.array(TeamSolutionSchema).safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        }
    })

    const ChallengeSolvedByRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {ChallengeSolvedByResponse, ChallengeSolvedByRequest, ChallengeSolvedBy}
}

const useSolveChallenge = (id: string) => {
    const client = useQueryClient()
    const {
        data: SolveChallengeResponse,
        mutate: SolveChallenge,
        isPending: PendingSolveChallenge
    } = useMutation({
        mutationKey: ["solve", id],
        mutationFn: async (data: ISolveChallenge) => await solveChallengeFn(id, data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['challenges']}).catch((e) => console.log(e))
            client.invalidateQueries({queryKey: ['challengeSolved', id]}).catch((e) => console.log(e))
        }
    })

    return {SolveChallengeResponse, SolveChallenge, PendingSolveChallenge}
}

export const useChallenge = () => {
    return {
        useGetChallenges,
        useChallengeSolvedBy,
        useSolveChallenge,
    }
};