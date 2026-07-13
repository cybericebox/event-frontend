'use client'
import type React from "react";
import {Spinner} from "@/components/ui/spinner";
import {useTeam} from "@/hooks/useTeam";
import {useEvent} from "@/hooks/useEvent";
import {ParticipationTypeEnum} from "@/types/event";
import TeamModel from "@/components/team/TeamModel";

interface WithTeamProps {
    children?: React.ReactNode;
}

export function WithTeamForm({children}: WithTeamProps) {
    const {GetTeamResponse, GetTeamRequest} = useTeam().useGetTeam()

    if (GetTeamRequest.isLoading) return <div className='flex justify-center items-center'><Spinner size="md" className="text-primary"/></div>

    if (GetTeamRequest.isSuccess && !!GetTeamResponse?.Data.Name) return children

    if (GetTeamRequest.isError) return <TeamModel/>

    return <></>
}

export function WithTeam({children}: WithTeamProps) {
    const {GetTeamResponse, GetTeamRequest} = useTeam().useGetTeam()

    if (GetTeamRequest.isSuccess && !!GetTeamResponse?.Data.Name) return children
    return <></>
}

export function WithTeamParticipation({children}: WithTeamProps) {
    const {GetEventInfoResponse, GetEventInfoRequest} = useEvent().useGetEventInfo()

    if (GetEventInfoRequest.isSuccess && GetEventInfoResponse?.Data.Participation === ParticipationTypeEnum.Team) return children
    return <></>
}
