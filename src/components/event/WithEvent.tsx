'use client'
import React, {useEffect} from "react";
import Loader from "@/components/Loaders";
import JoinEvent from "@/components/event/JoinEvent";
import {useEvent} from "@/hooks/useEvent";
import {AuthenticatedOnClient, AuthenticatedOnServer} from "@/hooks/auth";
import {ParticipationStatus, RegistrationType} from "@/types/event";
import {useRouter} from "next/navigation";
import {event} from "next/dist/build/output/log";

interface WithEventProps {
    children?: React.ReactNode;
    skip?: boolean;
}

export function WithEventForm({children, skip}: WithEventProps) {
    const joinEventStatus = useEvent().useGetJoinEventStatus(AuthenticatedOnClient().IsAuthenticated)
    const eventInfo = useEvent().useGetEventInfo()
    const router = useRouter()

    // if component need to be public dynamic
    if (skip) return children

    // run code only on client
    if(typeof window === 'undefined') {
        return <></>
    }

    // if user is not authenticated
    if (!AuthenticatedOnClient().IsAuthenticated) {
        return <JoinEvent needAuthentication/>
    }

    if (joinEventStatus.isSuccess) {
        if (joinEventStatus.data.Status === ParticipationStatus.ApprovedParticipationStatus) return children

        // return JoinEvent component if event is not assigned
        if (eventInfo.isSuccess && eventInfo.data) {
            if (eventInfo.data?.Registration !== RegistrationType.Close && new Date(eventInfo.data?.StartTime || 0).getTime() > Date.now()) return <JoinEvent/>
        }
        router.replace("/")
        return <></>
    }


    return <Loader/>
}

export function WithEvent({children}: WithEventProps) {
    const joinEventStatus = useEvent().useGetJoinEventStatus(AuthenticatedOnClient().IsAuthenticated)

    if (joinEventStatus.isSuccess && joinEventStatus.data.Joined) return children
    return <></>
}
