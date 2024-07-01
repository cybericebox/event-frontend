'use client'
import React, {useEffect, useState} from "react";
import {useEvent} from "@/hooks/useEvent";
import {CountdownTimer} from "@/components/Countdown";
import cn from "classnames";
import {useRouter} from "next/navigation";

interface JoinEventProps {
    needAuthentication?: boolean;
}

export default function JoinEvent({needAuthentication}: JoinEventProps) {
    const joinEvent = useEvent().useJoinEvent()
    const eventInfo = useEvent().useGetEventInfo()
    const router = useRouter()


    const onJoinEvent = () => {
        joinEvent.mutate()
    }
    const onNeedAuthentication = () => {
        router.push("/sign-in")
    }

    const joinMessage = "Доєднатися до заходу"
    const authenticationMessage = "Увійдіть в систему щоб доєднатися до заходу"

    return (
        <div
            className={"flex flex-col w-full items-center justify-center"}
        >
                <div
                    className={"text-lg md:text-xl font-bold text-[#211a52]"}
                >
                    <CountdownTimer
                        text={"До початку заходу залишилось"}
                        until={eventInfo.data?.StartTime || 0}
                        className={"rounded-lg border border-gray-200 shadow-md px-4 py-5"}
                    >
                        <button
                            className={cn(needAuthentication ? "bg-red-500" : "bg-[#211a52]", "w-full  hover:opacity-70 text-white font-bold py-2 px-4 rounded text-md md:text-lg")}
                            type="submit"
                            onClick={() => {
                                if (needAuthentication) {
                                    onNeedAuthentication()
                                } else {
                                    onJoinEvent()
                                }
                            }}
                        >
                            {needAuthentication ? authenticationMessage : joinMessage}
                        </button>
                    </CountdownTimer>
                </div>
        </div>
    );
}

