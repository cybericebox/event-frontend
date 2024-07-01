import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {getEventInfoFn, getJoinEventStatusFn, getScore, joinEventFn} from "@/api/eventAPI";


const useGetEventInfo = () => {
    return useQuery({
        queryKey: ['selfEvent'],
        queryFn: getEventInfoFn,
        refetchOnWindowFocus: true,
        refetchInterval: 5 * 60 * 1000,
        staleTime: 5 * 3000,
    })
}

const useGetJoinEventStatus = (enabled: boolean) => {
    return useQuery({
        queryKey: ['joinEventStatus'],
        queryFn: getJoinEventStatusFn,
        enabled: enabled,
        refetchOnWindowFocus: true,
        retry: 0,
    })
}

const useJoinEvent = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["joinEvent"],
        mutationFn: joinEventFn,
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['joinEventStatus']}).catch((e) => console.log(e))
        }
    })
}

const useGetScore = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['score'],
        queryFn: getScore,
        enabled: enabled,
        refetchOnWindowFocus: true,
        refetchInterval: 5 * 60 * 1000,
        staleTime: 5 * 3000,
        select: (data) => {
            data.ActiveChartSeries = []
            data.TeamsScores.forEach((team, index) => {
                if (index < 10) {
                    data.ActiveChartSeries.push({
                        name: team.TeamName,
                        data: team.TeamScoreTimeline,
                        type: 'line'
                    })
                }
            })

            return data
        }
    })

}

export const useEvent = () => {
    return {
        useGetEventInfo,
        useGetJoinEventStatus,
        useJoinEvent,
        useGetScore
    }
}
