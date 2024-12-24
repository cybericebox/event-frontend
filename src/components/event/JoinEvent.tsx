'use client'
import type React from "react";
import {useEvent} from "@/hooks/useEvent";
import {CountdownTimer} from "@/components/Countdown";
import Link from "next/link";
import {ClientAuthentication} from "@/hooks/auth";
import {EventTypeEnum, ParticipationStatusEnum} from "@/types/event";

interface JoinEventProps {
    status?: ParticipationStatusEnum
}

export default function JoinEvent({status}: JoinEventProps) {
    const {GetEventInfoResponse} = useEvent().useGetEventInfo()
    const {JoinEvent} = useEvent().useJoinEvent()

    const join = () => (
        <button
            onClick={() => JoinEvent()}
            className={"bg-[#211a52] w-full hover:opacity-70 text-white font-bold py-2 px-4 rounded text-md md:text-lg text-center"}
        >
            Доєднатися до заходу
        </button>
    )

    const pending = () => (
        <div
            className={"bg-gray-400 w-full hover:opacity-70 text-white font-bold py-2 px-4 rounded text-md md:text-lg text-center"}
        >
            Заявка на участь в заході розглядається. Очікуйте на результат
        </div>
    )

    const rejected = () => (
        <div
            className={"bg-red-500 w-full hover:opacity-70 text-white font-bold py-2 px-4 rounded text-md md:text-lg text-center"}
        >
            Заявка на участь в заході відхилена.<br/>Будь ласка, зверніться до організаторів
        </div>
    )
    return (
        <div
            className={"flex flex-col w-full items-center justify-center"}
        >
            <div
                className={"text-lg md:text-xl font-bold text-[#211a52]"}
            >
                <CountdownTimer
                    text={"До початку заходу залишилось"}
                    until={GetEventInfoResponse?.Data.StartTime || 0}
                    className={"rounded-lg border border-gray-200 shadow-md px-4 py-5"}
                    show={GetEventInfoResponse?.Data.Type === EventTypeEnum.Practice}
                    textAfter={"Захід вже розпочався"}
                >
                    {
                        ClientAuthentication().IsAuthenticated ?
                            status === ParticipationStatusEnum.NoParticipationStatus ?
                                join() :
                                status === ParticipationStatusEnum.PendingParticipationStatus ?
                                    pending() :
                                    status === ParticipationStatusEnum.RejectedParticipationStatus ?
                                        rejected() :
                                        null
                            : <Link href={"/api/events/self/join"}
                                              prefetch={false}
                                              className={"bg-[#211a52] w-full hover:opacity-70 text-white font-bold py-2 px-4 rounded text-md md:text-lg text-center"}
                            >
                                Доєднатися до заходу
                            </Link>
                    }

                </CountdownTimer>
            </div>
        </div>
    );
}

