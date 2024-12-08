'use client'
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {createTeamFn, getTeamFn, getVPNConfig, joinTeamFn} from "@/api/teamAPI";
import {ICreateTeam, IJoinTeam, TeamSchema, VPNConfigSchema} from "@/types/user";
import {ErrorInvalidResponseData} from "@/types/common";

const useGetTeam = () => {
    const {
        data: GetTeamResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetTeam
    } = useQuery({
        queryKey: ['selfTeam'],
        queryFn: getTeamFn,
        retry: 0,
        select: (data) => {
            const res = TeamSchema.safeParse(data.data.Data)
            if (!res.success) {
                console.log(res.error)
                throw ErrorInvalidResponseData
            } else {
                data.data.Data = res.data
            }

            return data.data
        }
    })

    const GetTeamRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetTeamResponse, GetTeamRequest, GetTeam}
}

const useGetVPNConfig = () => {
    const {
        data: GetVPNConfigResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetVPNConfig
    } = useQuery({
        queryKey: ['vpnConfig'],
        queryFn: getVPNConfig,
        retry: 0,
        enabled: false,
        select: (data) => {
            const res = VPNConfigSchema.safeParse(data.data.Data)
            if (!res.success) {
                console.log(res.error)
                throw ErrorInvalidResponseData
            } else {
                data.data.Data = res.data
            }

            return data.data
        }
    })

    const GetVPNConfigRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetVPNConfigResponse, GetVPNConfigRequest, GetVPNConfig}
}

const useCreateTeam = () => {
    const client = useQueryClient()
    const {
        data: CreateTeamResponse,
        mutate: CreateTeam,
        isPending: PendingCreate
    } = useMutation({
        mutationKey: ["createTeam"],
        mutationFn: async (data: ICreateTeam) => await createTeamFn(data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['selfTeam']}).catch((e) => console.log(e))
        }
    })
    return {CreateTeamResponse, CreateTeam, PendingCreate}
}

const useJoinTeam = () => {
    const client = useQueryClient()
    const {
        mutate: JoinTeam,
        isPending: PendingJoin,
        data: JoinTeamResponse
    } = useMutation({
        mutationKey: ["joinTeam"],
        mutationFn: async (data: IJoinTeam) => await joinTeamFn(data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['selfTeam']}).catch((e) => console.log(e))
        }
    })

    return {JoinTeam, PendingJoin, JoinTeamResponse}
}

export const useTeam = () => {
    return {
        useGetTeam,
        useGetVPNConfig,
        useCreateTeam,
        useJoinTeam,
    }
};