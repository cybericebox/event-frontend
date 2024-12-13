'use client'
import React from "react";
import Loader from "@/components/Loader";
import JoinEvent from "@/components/event/JoinEvent";
import {useEvent} from "@/hooks/useEvent";
import {ClientAuthentication} from "@/hooks/auth";
import {
    EventTypeEnum,
    ParticipationStatusEnum,
    RegistrationTypeEnum,
    ScoreboardVisibilityTypeEnum
} from "@/types/event";

interface WithEventProps {
    children?: React.ReactNode;
    skip?: boolean;
}

export function WithEventForm({children, skip}: WithEventProps) {
    const {GetJoinEventStatusResponse, GetJoinEventStatusRequest} = useEvent().useGetJoinEventStatus(ClientAuthentication().IsAuthenticated)
    const {GetEventInfoResponse, GetEventInfoRequest} = useEvent().useGetEventInfo()

    // if component need to be public dynamic
    if (skip) return children

    // run code only on client
    if(typeof window === 'undefined') {
        return <></>
    }

    if (GetJoinEventStatusRequest.isLoading) {
        return <Loader/>
    }

    // if user joins event
    if (GetJoinEventStatusRequest.isSuccess && GetJoinEventStatusResponse?.Data.Status === ParticipationStatusEnum.ApprovedParticipationStatus) return children

    if (GetEventInfoRequest.isSuccess && GetEventInfoResponse?.Data) {
        if (GetEventInfoResponse?.Data.Registration !== RegistrationTypeEnum.Close
            && ((GetEventInfoResponse?.Data.StartTime.getTime() > Date.now() && GetEventInfoResponse?.Data.Type === EventTypeEnum.Competition) ||
                (GetEventInfoResponse?.Data.Type === EventTypeEnum.Practice))
        ) return <JoinEvent status={GetJoinEventStatusResponse?.Data.Status}/>
    }

    return <></>
}

export function WithEvent({children}: WithEventProps) {
    const {GetJoinEventStatusResponse, GetJoinEventStatusRequest} = useEvent().useGetJoinEventStatus(ClientAuthentication().IsAuthenticated)

    if (GetJoinEventStatusRequest.isSuccess && GetJoinEventStatusResponse?.Data.Status === ParticipationStatusEnum.ApprovedParticipationStatus) return children
    return <></>
}

export function WithScoreBoard({children}: WithEventProps) {
    const {GetEventInfoResponse, GetEventInfoRequest} = useEvent().useGetEventInfo()

    if (GetEventInfoRequest.isSuccess && GetEventInfoResponse?.Data.ScoreboardAvailability != ScoreboardVisibilityTypeEnum.Hidden) return children
    return <></>
}
