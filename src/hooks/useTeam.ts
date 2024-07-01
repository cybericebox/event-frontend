'use client'
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {CreateTeamData, createTeamFn, getTeamFn, getVPNConfig, JoinTeamData, joinTeamFn} from "@/api/teamAPI";

const useGetTeam = (enabled: boolean) => {
    return useQuery({
        queryKey: ['selfTeam'],
        queryFn: getTeamFn,
        retry: 0,
        enabled: enabled,
    })
}

const useGetVPNConfig = () => {
    return useQuery({
        queryKey: ['vpnConfig'],
        queryFn: getVPNConfig,
        retry: 0,
        enabled: false,
    })

}

const useCreateTeam = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["createTeam"],
        mutationFn: async (data: CreateTeamData) => await createTeamFn(data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['selfTeam']}).catch((e) => console.log(e))
        }
    })
}

const useJoinTeam = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["joinTeam"],
        mutationFn: async (data: JoinTeamData) => await joinTeamFn(data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['selfTeam']}).catch((e) => console.log(e))
        }
    })
}

export const useTeam = () => {
    return {
        useGetTeam,
        useGetVPNConfig,
        useCreateTeam,
        useJoinTeam,
    }
};