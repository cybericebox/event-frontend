import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {getEventInfoFn, getJoinEventStatusFn, getScore, joinEventFn} from "@/api/eventAPI";
import {EventInfoSchema, EventScoreSchema, JoinEventInfoSchema} from "@/types/event";

const useGetEventInfo = () => {
    const {
        data: GetEventInfoResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetEventInfo
    } = useQuery({
        queryKey: ['selfEvent'],
        queryFn: getEventInfoFn,
        select: (data) => {
            const res = EventInfoSchema.safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        }
    })

    const GetEventInfoRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetEventInfoResponse, GetEventInfoRequest, GetEventInfo}
}

const useGetJoinEventStatus = (enabled: boolean) => {
    const {
        data: GetJoinEventStatusResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetJoinEventStatus
    } = useQuery({
        queryKey: ['joinEventStatus'],
        queryFn: getJoinEventStatusFn,
        enabled: enabled,
        refetchOnWindowFocus: true,
        retry: 0,
        select: (data) => {
            const res = JoinEventInfoSchema.safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        }
    })

    const GetJoinEventStatusRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetJoinEventStatusResponse, GetJoinEventStatusRequest, GetJoinEventStatus}
}

const useJoinEvent = () => {
    const client = useQueryClient()
    const {
        data: JoinEventResponse,
        mutate: JoinEvent,
        isPending: PendingJoinEvent
    } = useMutation({
        mutationFn: joinEventFn,
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['joinEventStatus']})
        }
    })

    return {JoinEventResponse, JoinEvent, PendingJoinEvent}
}

const useGetScore = (enabled: boolean) => {
    const {
        data: GetScoreResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetScore
    } =  useQuery({
        queryKey: ['score'],
        queryFn: getScore,
        enabled: enabled,
        refetchOnWindowFocus: true,
        refetchInterval: 5 * 60 * 1000,
        select: (data) => {
            // const res = EventScoreSchema.safeParse(data.data.Data)
            // if (!res.success) {
            //     throw new Error("Invalid response")
            // } else {
            //     data.data.Data = res.data
            // }

            data.data.Data.ActiveChartSeries = []
            data.data.Data.TeamsScores.forEach((team, index) => {
                if (index < 10) {
                    data.data.Data.ActiveChartSeries?.push({
                        name: team.TeamName,
                        data: team.TeamScoreTimeline,
                        type: 'line'
                    })
                }
            })

            return data.data
        }
    })

    const GetScoreRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetScoreResponse, GetScoreRequest, GetScore}
}

export const useEvent = () => {
    return {
        useGetEventInfo,
        useGetJoinEventStatus,
        useJoinEvent,
        useGetScore
    }
}
