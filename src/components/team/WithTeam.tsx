'use client'
import type React from "react";
import Loader from "@/components/Loaders";
import {useTeam} from "@/hooks/useTeam";
import {useEvent} from "@/hooks/useEvent";
import {ParticipationType} from "@/types/event";
import TeamModel from "@/components/team/TeamModel";

interface WithTeamProps {
    children?: React.ReactNode;
}

export function WithTeamForm({children}: WithTeamProps) {
    const getSelfTeam = useTeam().useGetTeam(true)

    if (getSelfTeam.isSuccess) {
        if (!!getSelfTeam.data.Name) return children
        return <TeamModel />
    }

    return <Loader/>
}

export function WithTeam({children}: WithTeamProps) {
    const getSelfTeam = useTeam().useGetTeam(true)

    if (getSelfTeam.isSuccess && !!getSelfTeam.data.Name) return children
    return <></>
}

export function WithTeamParticipation({children}: WithTeamProps) {
    const getEventInfo = useEvent().useGetEventInfo()

    if (getEventInfo.isSuccess && getEventInfo.data.Participation === ParticipationType.Team) return children
    return <></>
}
